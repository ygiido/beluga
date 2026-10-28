const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { db, getSettings } = require('../../database/db');
const { checkCurse, checkScam } = require('./normalizer');

// Kullanıcı spam takibi için hafıza havuzları
const messageHistory = new Map(); // userId -> [timestamps]
const mediaHistory = new Map();   // userId -> [timestamps]
const warningCounts = new Map();  // guildId:userId -> count

async function handleMessageModeration(message) {
  if (!message.guild || message.author.bot) return;

  const guildId = message.guild.id;
  const userId = message.author.id;
  const settings = getSettings(guildId);
  const now = Date.now();

  // Yetkilileri muaf tut
  if (message.member && message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
    return;
  }

  // 1. Phishing & Scam Kalkanı
  if (settings.anti_scam_enabled) {
    const scamCheck = checkScam(message.content);
    if (scamCheck.isScam) {
      try {
        await message.delete();
      } catch (e) {}

      await applyJail(message.guild, message.member, 'Zararlı Bağlantı / Oltalama (Scam) Paylaşımı', null, 3);
      sendSecurityAlert(message.guild, `🚨 **Oltalama Bağlantısı Tespit Edildi!**\n**Üye:** <@${userId}>\n**Sebep:** ${scamCheck.pattern}\nÜye derhal hapse (Jail) atıldı.`);
      return;
    }
  }

  // 2. Anti-Bypass Küfür Koruması
  if (settings.anti_curse_enabled) {
    const curseCheck = checkCurse(message.content);
    if (curseCheck.hasCurse) {
      try {
        await message.delete();
      } catch (e) {}

      const key = `${guildId}:${userId}`;
      const count = (warningCounts.get(key) || 0) + 1;
      warningCounts.set(key, count);

      if (count < 3) {
        // 1. ve 2. İhlal: 6 saniyede kendini imha eden uyarı
        const warnEmbed = new EmbedBuilder()
          .setColor(0xFFA500)
          .setDescription(`⚠️ <@${userId}>, lütfen kelimelerine dikkat et! (İhlal: **${count}/3**)\n*Bu uyarı 6 saniye sonra silinecektir.*`);

        const warnMsg = await message.channel.send({ embeds: [warnEmbed] }).catch(() => null);
        if (warnMsg) {
          setTimeout(() => warnMsg.delete().catch(() => null), 6000);
        }
      } else {
        // 3. İhlal: Otomatik Hapis (Jail)
        warningCounts.delete(key);
        await applyJail(message.guild, message.member, 'Küfür / Hakaret (3. İhlal)', 30 * 60 * 1000, 1); // 30 dk hapis, 1 sicil puanı
        const jailNotice = await message.channel.send(`⛓️ <@${userId}>, 3. küfür ihlali nedeniyle geçici olarak hapse (Jail) atıldı.`).catch(() => null);
        if (jailNotice) setTimeout(() => jailNotice.delete().catch(() => null), 10000);
      }
      return;
    }
  }

  // 3. Metin Spam Koruması (3 saniyede 4 mesaj)
  if (settings.anti_spam_enabled) {
    const userMsgs = messageHistory.get(userId) || [];
    const recentMsgs = userMsgs.filter(t => now - t < 3000);
    recentMsgs.push(now);
    messageHistory.set(userId, recentMsgs);

    if (recentMsgs.length >= 4) {
      messageHistory.delete(userId);
      try {
        await message.delete();
      } catch (e) {}

      // Tekrar spam kontrolü
      const spamInfraction = db.prepare('SELECT COUNT(*) as count FROM infractions WHERE guild_id = ? AND user_id = ? AND type = "spam" AND created_at > ?')
        .get(guildId, userId, now - (24 * 60 * 60 * 1000));

      if (spamInfraction && spamInfraction.count >= 1) {
        // Tekrarında doğrudan Jail
        await applyJail(message.guild, message.member, 'Tekrarlanan Seri Spam', 60 * 60 * 1000, 2);
        await message.channel.send(`⛓️ <@${userId}>, devam eden spam eylemi nedeniyle hapse (Jail) atıldı.`).catch(() => null);
      } else {
        // İlk ihlalde 3 dakika Timeout
        try {
          await message.member.timeout(3 * 60 * 1000, 'Seri Spam Koruması');
          db.prepare('INSERT INTO infractions (guild_id, user_id, type, reason, points, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
            .run(guildId, userId, 'spam', '3 saniyede 4 mesaj spamı', 1, now, now + 3 * 60 * 1000);

          const timeoutMsg = await message.channel.send(`⏳ <@${userId}>, seri spam yaptığı için **3 dakika zaman aşımına (timeout)** uğratıldı.`).catch(() => null);
          if (timeoutMsg) setTimeout(() => timeoutMsg.delete().catch(() => null), 8000);
        } catch (e) {}
      }
      return;
    }

    // 4. Medya / Görsel / Link Spamı (5 saniyede 3 medya veya link)
    const hasMedia = message.attachments.size > 0 || /(https?:\/\/[^\s]+)/g.test(message.content);
    if (hasMedia) {
      const userMedias = mediaHistory.get(userId) || [];
      const recentMedias = userMedias.filter(t => now - t < 5000);
      recentMedias.push(now);
      mediaHistory.set(userId, recentMedias);

      if (recentMedias.length >= 3) {
        mediaHistory.delete(userId);
        try {
          await message.delete();
          await message.member.timeout(5 * 60 * 1000, 'Medya / Link Spam Koruması');
          const mediaWarn = await message.channel.send(`⏳ <@${userId}>, seri görsel/link spamı yaptığı için **5 dakika zaman aşımına** alındı.`).catch(() => null);
          if (mediaWarn) setTimeout(() => mediaWarn.delete().catch(() => null), 8000);
        } catch (e) {}
        return;
      }
    }
  }
}

async function applyJail(guild, member, reason, durationMs = null, points = 1) {
  if (!member) return;
  const settings = getSettings(guild.id);
  const now = Date.now();
  const expiresAt = durationMs ? now + durationMs : null;

  const currentRoles = member.roles.cache
    .filter(r => r.id !== guild.id && !r.managed)
    .map(r => r.id);

  // Rolleri kaydet ve kaldır
  try {
    if (settings.jail_role_id) {
      await member.roles.set([settings.jail_role_id], `Jail Cezası: ${reason}`);
    }
  } catch (err) {
    console.error('Jail rolü atanırken hata:', err);
  }

  // Veritabanına işle
  db.prepare(`
    INSERT INTO infractions (guild_id, user_id, type, reason, points, created_at, expires_at, is_active, previous_roles)
    VALUES (?, ?, 'jail', ?, ?, ?, ?, 1, ?)
  `).run(guild.id, member.id, reason, points, now, expiresAt, JSON.stringify(currentRoles));

  // Sicil puanı kontrolü ve kalıcı sicilli rolü (11 ihlal veya 10 dk üzeri ağır ceza)
  checkSicilThreshold(guild, member);

  // Moderasyon Logu
  sendLog(guild, settings.log_mod_channel_id, new EmbedBuilder()
    .setColor(0xFF0000)
    .setTitle('⛓️ Yeni Hapis (Jail) İşlemi')
    .addFields(
      { name: 'Kullanıcı', value: `<@${member.id}> (${member.user.tag})`, inline: true },
      { name: 'Sebep', value: reason, inline: true },
      { name: 'Süre', value: durationMs ? `${Math.round(durationMs / 60000)} dakika` : 'Süresiz', inline: true },
      { name: 'Sicil Puanı', value: `+${points}`, inline: true }
    )
    .setTimestamp()
  );
}

async function checkSicilThreshold(guild, member) {
  const settings = getSettings(guild.id);
  if (!settings.sicilli_role_id) return;

  const totalPoints = db.prepare('SELECT SUM(points) as total, COUNT(*) as count FROM infractions WHERE guild_id = ? AND user_id = ?')
    .get(guild.id, member.id);

  if (totalPoints && (totalPoints.count >= 11 || (totalPoints.total && totalPoints.total >= 10))) {
    if (!member.roles.cache.has(settings.sicilli_role_id)) {
      await member.roles.add(settings.sicilli_role_id, 'Sicil Puanı / İhlal Eşiği Aşıldı').catch(() => null);
      sendLog(guild, settings.log_security_channel_id, new EmbedBuilder()
        .setColor(0x8B0000)
        .setTitle('⚠️ Kalıcı Sicilli Rolü Atandı')
        .setDescription(`<@${member.id}> toplam **${totalPoints.count}** ihlal ve **${totalPoints.total}** sicil puanına ulaştığı için kalıcı "Sicilli" rolüne alındı.`)
        .setTimestamp()
      );
    }
  }
}

// Otomatik Tahliye Döngüsü (Her 30 saniyede bir çalışır)
function initReleaseScheduler(client) {
  setInterval(async () => {
    const now = Date.now();
    const expiredInfractions = db.prepare('SELECT * FROM infractions WHERE is_active = 1 AND expires_at IS NOT NULL AND expires_at <= ?')
      .all(now);

    for (const inf of expiredInfractions) {
      try {
        const guild = client.guilds.cache.get(inf.guild_id);
        if (!guild) continue;

        const member = await guild.members.fetch(inf.user_id).catch(() => null);
        const settings = getSettings(inf.guild_id);

        if (member) {
          // Jail rolünü kaldır
          if (settings.jail_role_id && member.roles.cache.has(settings.jail_role_id)) {
            await member.roles.remove(settings.jail_role_id, 'Ceza Süresi Doldu (Otomatik Tahliye)').catch(() => null);
          }

          // Önceki rolleri iade et
          if (inf.previous_roles) {
            try {
              const prevRoles = JSON.parse(inf.previous_roles);
              await member.roles.add(prevRoles, 'Önceki Roller İade Edildi').catch(() => null);
            } catch (e) {}
          }

          // Log kaydı
          sendLog(guild, settings.log_mod_channel_id, new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('🔓 Otomatik Tahliye (Ceza Bitti)')
            .setDescription(`<@${inf.user_id}> için hapis süresi doldu. Eski rolleri iade edildi.`)
            .setTimestamp()
          );
        }

        // Pasif hale getir
        db.prepare('UPDATE infractions SET is_active = 0 WHERE id = ?').run(inf.id);
      } catch (err) {
        console.error('Tahliye hatası:', err);
      }
    }
  }, 30000);
}

function sendLog(guild, channelId, embed) {
  if (!channelId) return;
  const channel = guild.channels.cache.get(channelId);
  if (channel && channel.isTextBased()) {
    channel.send({ embeds: [embed] }).catch(() => null);
  }
}

function sendSecurityAlert(guild, text) {
  const settings = getSettings(guild.id);
  sendLog(guild, settings.log_security_channel_id, new EmbedBuilder()
    .setColor(0xFF0000)
    .setTitle('🚨 Güvenlik Alarmı')
    .setDescription(text)
    .setTimestamp()
  );
}

module.exports = {
  handleMessageModeration,
  applyJail,
  checkSicilThreshold,
  initReleaseScheduler,
  sendLog,
  sendSecurityAlert
};


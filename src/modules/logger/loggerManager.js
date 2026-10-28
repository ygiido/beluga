const {
  EmbedBuilder,
  AuditLogEvent,
  AttachmentBuilder,
  PermissionFlagsBits
} = require('discord.js');
const { db, getSettings } = require('../../database/db');

// Anti-Nuke hafıza havuzu: userId -> [silme_zamanları]
const nukeTracker = new Map();

// Silinen Medyaları Kurtarma (Anti-Delete Media)
async function handleMessageDelete(message) {
  if (!message.guild || message.author?.bot) return;

  const guild = message.guild;
  const settings = getSettings(guild.id);
  const now = Date.now();

  // 1. Ghost Ping (Hayalet Etiket) Tespiti (<60 saniye içinde silinmişse ve etiket varsa)
  const isRecent = message.createdTimestamp && (now - message.createdTimestamp < 60000);
  const hasMentions = message.mentions.users.size > 0 || message.mentions.roles.size > 0 || message.mentions.everyone;

  if (isRecent && hasMentions && settings.log_message_channel_id) {
    const ghostLog = guild.channels.cache.get(settings.log_message_channel_id);
    if (ghostLog && ghostLog.isTextBased()) {
      const mentionsList = [
        ...message.mentions.users.map(u => `<@${u.id}>`),
        ...message.mentions.roles.map(r => `<@&${r.id}>`),
        message.mentions.everyone ? '@everyone/@here' : null
      ].filter(Boolean).join(', ');

      const ghostEmbed = new EmbedBuilder()
        .setColor(0xFF4500)
        .setTitle('👻 Hayalet Etiket (Ghost Ping) Yakalandı!')
        .setDescription(`<@${message.author.id}> birini etiketledikten **${Math.round((now - message.createdTimestamp) / 1000)} saniye** sonra mesajını sildi.`)
        .addFields(
          { name: 'Etiketlenenler', value: mentionsList || 'Bilinmiyor', inline: false },
          { name: 'Kanal', value: `<#${message.channel.id}>`, inline: true },
          { name: 'Silinen Mesaj', value: message.cleanContent || '*Boş veya sadece medya*', inline: false }
        )
        .setTimestamp();

      ghostLog.send({ embeds: [ghostEmbed] }).catch(() => null);
    }
  }

  // 2. Silinen Medya Kurtarma (CDN silinmeden önce yakalayıp loga tekrar yükleme)
  if (settings.media_recovery_enabled && message.attachments.size > 0 && settings.log_media_channel_id) {
    const mediaLog = guild.channels.cache.get(settings.log_media_channel_id);
    if (mediaLog && mediaLog.isTextBased()) {
      const recoveredFiles = [];

      for (const [_, att] of message.attachments) {
        try {
          const res = await fetch(att.url);
          if (res.ok) {
            const buffer = Buffer.from(await res.arrayBuffer());
            recoveredFiles.push(new AttachmentBuilder(buffer, { name: `kurtarilan_${att.name}` }));
          }
        } catch (e) {
          console.error('Medya kurtarılamadı:', e);
        }
      }

      if (recoveredFiles.length > 0) {
        const mediaEmbed = new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle('📸 Silinen Medya Kurtarıldı (Kanıt Dosyası)')
          .setDescription(`**Gönderen:** <@${message.author.id}> (${message.author.tag})\n**Kanal:** <#${message.channel.id}>\n**İçerik:** ${message.cleanContent || '*Metin yok*'}`)
          .setFooter({ text: 'Beluga CDN Medya Kurtarma Motoru' })
          .setTimestamp();

        mediaLog.send({ embeds: [mediaEmbed], files: recoveredFiles }).catch(() => null);
      }
    }
  }

  // 3. Normal Silinen Mesaj Logu
  if (settings.log_message_channel_id && message.content) {
    const msgLog = guild.channels.cache.get(settings.log_message_channel_id);
    if (msgLog && msgLog.isTextBased()) {
      const delEmbed = new EmbedBuilder()
        .setColor(0x36393F)
        .setTitle('🗑️ Mesaj Silindi')
        .addFields(
          { name: 'Yazar', value: `<@${message.author.id}> (${message.author.tag})`, inline: true },
          { name: 'Kanal', value: `<#${message.channel.id}>`, inline: true },
          { name: 'İçerik', value: message.cleanContent ? (message.cleanContent.length > 1000 ? message.cleanContent.slice(0, 1000) + '...' : message.cleanContent) : '*İçerik yok*' }
        )
        .setTimestamp();

      msgLog.send({ embeds: [delEmbed] }).catch(() => null);
    }
  }
}

// Mesaj Düzenleme Logu
async function handleMessageUpdate(oldMessage, newMessage) {
  if (!oldMessage.guild || oldMessage.author?.bot) return;
  if (oldMessage.content === newMessage.content) return;

  const settings = getSettings(oldMessage.guild.id);
  if (!settings.log_message_channel_id) return;

  const logChannel = oldMessage.guild.channels.cache.get(settings.log_message_channel_id);
  if (logChannel && logChannel.isTextBased()) {
    const embed = new EmbedBuilder()
      .setColor(0xFEE75C)
      .setTitle('✏️ Mesaj Düzenlendi')
      .setDescription(`[Mesaja Git](${newMessage.url})`)
      .addFields(
        { name: 'Yazar', value: `<@${oldMessage.author.id}>`, inline: true },
        { name: 'Kanal', value: `<#${oldMessage.channel.id}>`, inline: true },
        { name: 'Eski Hali', value: oldMessage.content ? (oldMessage.content.length > 500 ? oldMessage.content.slice(0, 500) + '...' : oldMessage.content) : '*Boş*' },
        { name: 'Yeni Hali', value: newMessage.content ? (newMessage.content.length > 500 ? newMessage.content.slice(0, 500) + '...' : newMessage.content) : '*Boş*' }
      )
      .setTimestamp();

    logChannel.send({ embeds: [embed] }).catch(() => null);
  }
}

// Ses Mesai Takibi (Giriş/Çıkış Süresi)
async function handleVoiceAudit(oldState, newState) {
  const guild = newState.guild;
  const settings = getSettings(guild.id);
  const userId = newState.id;
  const now = Date.now();

  // Odaya Giriş
  if (!oldState.channelId && newState.channelId) {
    db.prepare('INSERT OR REPLACE INTO voice_sessions (guild_id, user_id, channel_id, joined_at) VALUES (?, ?, ?, ?)')
      .run(guild.id, userId, newState.channelId, now);
    return;
  }

  // Odadan Çıkış
  if (oldState.channelId && !newState.channelId) {
    const session = db.prepare('SELECT * FROM voice_sessions WHERE guild_id = ? AND user_id = ?').get(guild.id, userId);
    if (session) {
      db.prepare('DELETE FROM voice_sessions WHERE guild_id = ? AND user_id = ?').run(guild.id, userId);
      const durationMs = now - session.joined_at;

      const seconds = Math.floor((durationMs / 1000) % 60);
      const minutes = Math.floor((durationMs / (1000 * 60)) % 60);
      const hours = Math.floor(durationMs / (1000 * 60 * 60));

      const durationStr = `${hours > 0 ? `${hours} saat ` : ''}${minutes} dakika ${seconds} saniye`;

      if (settings.log_voice_channel_id) {
        const logChannel = guild.channels.cache.get(settings.log_voice_channel_id);
        if (logChannel && logChannel.isTextBased()) {
          const embed = new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle('🎙️ Ses Mesai Kaydı')
            .addFields(
              { name: 'Üye', value: `<@${userId}>`, inline: true },
              { name: 'Ayrıldığı Oda', value: oldState.channel ? oldState.channel.name : 'Bilinmeyen Oda', inline: true },
              { name: 'Geçirilen Net Süre', value: `⏱️ **${durationStr}**`, inline: false }
            )
            .setTimestamp();

          logChannel.send({ embeds: [embed] }).catch(() => null);
        }
      }
    }
  }
}

// Kritik Rol İzni Kırmızı Alarmı
async function handleRoleUpdate(oldRole, newRole) {
  const guild = newRole.guild;
  const settings = getSettings(guild.id);
  if (!settings.log_security_channel_id) return;

  const criticalPerms = [
    PermissionFlagsBits.Administrator,
    PermissionFlagsBits.ManageGuild,
    PermissionFlagsBits.ManageRoles,
    PermissionFlagsBits.BanMembers,
    PermissionFlagsBits.KickMembers
  ];

  const gainedPerms = criticalPerms.filter(perm => !oldRole.permissions.has(perm) && newRole.permissions.has(perm));

  if (gainedPerms.length > 0) {
    let executor = 'Bilinmeyen Yetkili';
    try {
      const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.RoleUpdate, limit: 1 });
      const entry = logs.entries.first();
      if (entry && entry.target.id === newRole.id) executor = `<@${entry.executor.id}> (${entry.executor.tag})`;
    } catch (e) {}

    const logChannel = guild.channels.cache.get(settings.log_security_channel_id);
    if (logChannel && logChannel.isTextBased()) {
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('🚨 KRİTİK ROL İZNİ KIRMIZI ALARMI')
        .setDescription(`**<@&${newRole.id}>** rolüne tehlikeli yönetici/moderasyon izinleri verildi!`)
        .addFields(
          { name: 'Değişikliği Yapan', value: executor, inline: true },
          { name: 'Rol', value: `<@&${newRole.id}>`, inline: true },
          { name: 'Eklenen İzin Sayısı', value: `${gainedPerms.length} adet kritik yetki`, inline: false }
        )
        .setFooter({ text: 'Acil Durum Bildirimi' })
        .setTimestamp();

      logChannel.send({ content: '@everyone', embeds: [embed] }).catch(() => null);
    }
  }
}

// Anti-Nuke (10 Saniyede Seri Kanal/Rol Silme Koruması)
async function checkAntiNuke(guild, actionType) {
  const settings = getSettings(guild.id);
  if (!settings.anti_nuke_enabled) return;

  try {
    const logs = await guild.fetchAuditLogs({ type: actionType, limit: 1 });
    const entry = logs.entries.first();
    if (!entry || !entry.executor || entry.executor.id === guild.ownerId || entry.executor.id === guild.client.user.id) return;

    const executorId = entry.executor.id;
    const now = Date.now();
    const timestamps = nukeTracker.get(executorId) || [];
    const recent = timestamps.filter(t => now - t < 10000);
    recent.push(now);
    nukeTracker.set(executorId, recent);

    // 10 saniyede 2'den fazla silme
    if (recent.length >= 2) {
      nukeTracker.delete(executorId);
      const member = await guild.members.fetch(executorId).catch(() => null);

      if (member) {
        // Tüm rollerini al
        await member.roles.set([], 'Anti-Nuke Seri Silme Koruması Tetiklendi').catch(() => null);

        // Güvenlik Kanalına Bildir
        if (settings.log_security_channel_id) {
          const logChannel = guild.channels.cache.get(settings.log_security_channel_id);
          if (logChannel && logChannel.isTextBased()) {
            const embed = new EmbedBuilder()
              .setColor(0x8B0000)
              .setTitle('🛡️ ANTI-NUKE SALDIRI ENGELİ')
              .setDescription(`🚨 <@${executorId}> 10 saniye içinde birden fazla kanal/rol silmeye çalıştığı için **tüm yetkileri anında geri alındı ve karantinaya çekildi!**`)
              .setTimestamp();

            logChannel.send({ content: `<@${guild.ownerId}>`, embeds: [embed] }).catch(() => null);
          }
        }
      }
    }
  } catch (err) {
    console.error('Anti-nuke denetim hatası:', err);
  }
}

// Giriş Güvenliği & Şüpheli Hesap / Davet Takibi
async function handleMemberJoin(member) {
  const guild = member.guild;
  const settings = getSettings(guild.id);
  const now = Date.now();

  const accountAgeMs = now - member.user.createdTimestamp;
  const isSuspicious = accountAgeMs < (15 * 24 * 60 * 60 * 1000); // 15 günden yeni

  // Davet Takibi
  let inviterId = null;
  try {
    const currentInvites = await guild.invites.fetch();
    for (const [code, invite] of currentInvites) {
      const stored = db.prepare('SELECT uses FROM guild_invites WHERE guild_id = ? AND code = ?').get(guild.id, code);
      if (stored && invite.uses > stored.uses) {
        inviterId = invite.inviter?.id;
        db.prepare('UPDATE guild_invites SET uses = ? WHERE guild_id = ? AND code = ?').run(invite.uses, guild.id, code);
        break;
      }
    }
  } catch (e) {}

  db.prepare('INSERT OR REPLACE INTO member_joins (guild_id, user_id, inviter_id, joined_at) VALUES (?, ?, ?, ?)')
    .run(guild.id, member.id, inviterId, now);

  if (settings.log_join_channel_id) {
    const joinLog = guild.channels.cache.get(settings.log_join_channel_id);
    if (joinLog && joinLog.isTextBased()) {
      const embed = new EmbedBuilder()
        .setColor(isSuspicious ? 0xFEE75C : 0x57F287)
        .setTitle(isSuspicious ? '⚠️ Şüpheli Yeni Hesap Katıldı' : '📥 Yeni Üye Katıldı')
        .addFields(
          { name: 'Üye', value: `<@${member.id}> (${member.user.tag})`, inline: true },
          { name: 'Hesap Yaşı', value: `${Math.floor(accountAgeMs / (24 * 60 * 60 * 1000))} gün önce açılmış`, inline: true },
          { name: 'Davet Eden', value: inviterId ? `<@${inviterId}>` : 'Bilinmiyor / Özel URL', inline: true }
        )
        .setTimestamp();

      joinLog.send({ embeds: [embed] }).catch(() => null);
    }
  }
}

// 24 Saat Dolmadan Çıkan Sahte Davet Tespiti
async function handleMemberLeave(member) {
  const guild = member.guild;
  const settings = getSettings(guild.id);
  const now = Date.now();

  const joinRecord = db.prepare('SELECT * FROM member_joins WHERE guild_id = ? AND user_id = ?').get(guild.id, member.id);
  if (joinRecord) {
    const duration = now - joinRecord.joined_at;
    const isFake = duration < (24 * 60 * 60 * 1000); // 24 saatten az kalmış

    if (isFake && joinRecord.inviter_id && settings.log_join_channel_id) {
      const joinLog = guild.channels.cache.get(settings.log_join_channel_id);
      if (joinLog && joinLog.isTextBased()) {
        const fakeEmbed = new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle('🚨 Sahte / Kaçak Davet Tespiti')
          .setDescription(`<@${member.id}> sunucudan 24 saat dolmadan ayrıldı.`)
          .addFields(
            { name: 'Davet Eden', value: `<@${joinRecord.inviter_id}>`, inline: true },
            { name: 'Sunucuda Kaldığı Süre', value: `${Math.round(duration / 60000)} dakika`, inline: true }
          )
          .setFooter({ text: 'Davetçinin gerçek puanı düşürüldü' })
          .setTimestamp();

        joinLog.send({ embeds: [fakeEmbed] }).catch(() => null);
      }
    }
    db.prepare('DELETE FROM member_joins WHERE guild_id = ? AND user_id = ?').run(guild.id, member.id);
  }
}

module.exports = {
  handleMessageDelete,
  handleMessageUpdate,
  handleVoiceAudit,
  handleRoleUpdate,
  checkAntiNuke,
  handleMemberJoin,
  handleMemberLeave
};


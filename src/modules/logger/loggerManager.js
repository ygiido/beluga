const {
  EmbedBuilder,
  AuditLogEvent,
  AttachmentBuilder,
  PermissionFlagsBits
} = require('discord.js');
const { db, getLogChannels } = require('../../database/db');

// Anti-Nuke hafıza havuzu: executorId -> [timestamps]
const nukeTracker = new Map();

// Yardımcı embed gönderici
async function sendEmbed(guild, channelKey, embed, extra = {}) {
  const settings = getLogChannels(guild.id);
  const targetChannelId = settings[channelKey];
  if (!targetChannelId) return;

  const channel = guild.channels.cache.get(targetChannelId);
  if (channel && channel.isTextBased()) {
    return channel.send({ embeds: [embed], ...extra }).catch(() => null);
  }
}

// -------------------------------------------------------------
// 1. SES LOGLARI (Voice Events)
// -------------------------------------------------------------
async function handleVoiceState(oldState, newState) {
  const guild = newState.guild;
  const user = newState.member?.user || oldState.member?.user;
  if (!user || user.bot) return;

  const now = Date.now();
  const userId = user.id;

  // A. Odaya Katıldı
  if (!oldState.channelId && newState.channelId) {
    db.prepare('INSERT OR REPLACE INTO voice_sessions (guild_id, user_id, channel_id, joined_at) VALUES (?, ?, ?, ?)')
      .run(guild.id, userId, newState.channelId, now);

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('🎙️ Ses Kanalına Katıldı')
      .setDescription(`<@${userId}> (**${user.tag}**) ses kanalına giriş yaptı.`)
      .addFields(
        { name: 'Kanal', value: `🔊 <#${newState.channelId}> (${newState.channel.name})`, inline: true }
      )
      .setTimestamp();

    return sendEmbed(guild, 'voice_log', embed);
  }

  // B. Odadan Ayrıldı (Net Mesai Süresi Hesaplama)
  if (oldState.channelId && !newState.channelId) {
    const session = db.prepare('SELECT * FROM voice_sessions WHERE guild_id = ? AND user_id = ?').get(guild.id, userId);
    let durationStr = 'Hesaplanamadı';

    if (session) {
      db.prepare('DELETE FROM voice_sessions WHERE guild_id = ? AND user_id = ?').run(guild.id, userId);
      const diffMs = now - session.joined_at;
      const sec = Math.floor((diffMs / 1000) % 60);
      const min = Math.floor((diffMs / (1000 * 60)) % 60);
      const hrs = Math.floor(diffMs / (1000 * 60 * 60));
      durationStr = `${hrs > 0 ? `${hrs} saat ` : ''}${min} dakika ${sec} saniye`;
    }

    const embed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle('👋 Ses Kanalından Ayrıldı')
      .setDescription(`<@${userId}> (**${user.tag}**) sesten çıktı.`)
      .addFields(
        { name: 'Ayrıldığı Kanal', value: `🔊 ${oldState.channel?.name || 'Bilinmiyor'}`, inline: true },
        { name: 'Geçirilen Net Süre', value: `⏱️ **${durationStr}**`, inline: true }
      )
      .setTimestamp();

    return sendEmbed(guild, 'voice_log', embed);
  }

  // C. Kanal Değiştirdi
  if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('🔀 Ses Kanalı Değiştirdi')
      .setDescription(`<@${userId}> bir ses odasından diğerine geçti.`)
      .addFields(
        { name: 'Eski Kanal', value: `🔊 <#${oldState.channelId}> (${oldState.channel?.name})`, inline: true },
        { name: 'Yeni Kanal', value: `🔊 <#${newState.channelId}> (${newState.channel?.name})`, inline: true }
      )
      .setTimestamp();

    return sendEmbed(guild, 'voice_log', embed);
  }

  // D. Kendi Mikrofonunu Açtı / Kapattı (Self Mute)
  if (oldState.selfMute !== newState.selfMute) {
    const isMuted = newState.selfMute;
    const embed = new EmbedBuilder()
      .setColor(isMuted ? 0xFEE75C : 0x57F287)
      .setDescription(`<@${userId}> mikrofonunu **${isMuted ? 'kapattı 🔇' : 'açtı 🎙️'}**. (Kanal: <#${newState.channelId}>)`)
      .setTimestamp();

    return sendEmbed(guild, 'voice_log', embed);
  }

  // E. Kendi Kulaklığını Kapattı / Açtı (Self Deafen)
  if (oldState.selfDeaf !== newState.selfDeaf) {
    const isDeaf = newState.selfDeaf;
    const embed = new EmbedBuilder()
      .setColor(isDeaf ? 0xED4245 : 0x57F287)
      .setDescription(`<@${userId}> kulaklığını **${isDeaf ? 'kapattı (sağırlaştı) 🎧' : 'açtı 🔊'}**. (Kanal: <#${newState.channelId}>)`)
      .setTimestamp();

    return sendEmbed(guild, 'voice_log', embed);
  }

  // F. Sunucu Tarafından Susturuldu / Açıldı (Server Mute)
  if (oldState.serverMute !== newState.serverMute) {
    const isServerMuted = newState.serverMute;
    let executor = 'Yetkili';
    try {
      const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberUpdate, limit: 1 });
      const entry = logs.entries.first();
      if (entry && entry.target.id === userId) executor = `<@${entry.executor.id}>`;
    } catch (e) {}

    const embed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle(isServerMuted ? '🛑 Sunucu Tarafından Susturuldu' : '✅ Sunucu Susturması Kaldırıldı')
      .setDescription(`<@${userId}> üyesinin mikrofonu ${executor} tarafından **${isServerMuted ? 'kapatıldı' : 'açıldı'}**.`)
      .setTimestamp();

    return sendEmbed(guild, 'voice_log', embed);
  }

  // G. Sunucu Tarafından Sağırlaştırıldı / Açıldı (Server Deafen)
  if (oldState.serverDeaf !== newState.serverDeaf) {
    const isServerDeaf = newState.serverDeaf;
    const embed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle(isServerDeaf ? '🛑 Sunucu Tarafından Sağırlaştırıldı' : '✅ Sunucu Sağırlaştırması Kaldırıldı')
      .setDescription(`<@${userId}> üyesinin sesi sunucu tarafından **${isServerDeaf ? 'sağırlaştırıldı' : 'açıldı'}**.`)
      .setTimestamp();

    return sendEmbed(guild, 'voice_log', embed);
  }

  // H. Kamera Açtı / Kapattı (Self Video)
  if (oldState.selfVideo !== newState.selfVideo) {
    const isVideo = newState.selfVideo;
    const embed = new EmbedBuilder()
      .setColor(isVideo ? 0x9B59B6 : 0x7289DA)
      .setDescription(`<@${userId}> kamerasını **${isVideo ? 'açtı 📹' : 'kapattı 📷'}**. (Kanal: <#${newState.channelId}>)`)
      .setTimestamp();

    return sendEmbed(guild, 'voice_log', embed);
  }

  // I. Ekran Yayını Başlattı / Durdurdu (Streaming)
  if (oldState.streaming !== newState.streaming) {
    const isStreaming = newState.streaming;
    const embed = new EmbedBuilder()
      .setColor(isStreaming ? 0xEB459E : 0x7289DA)
      .setDescription(`<@${userId}> ekran/oyun yayınını **${isStreaming ? 'başlattı 🖥️' : 'durdurdu ⏹️'}**. (Kanal: <#${newState.channelId}>)`)
      .setTimestamp();

    return sendEmbed(guild, 'voice_log', embed);
  }
}

// -------------------------------------------------------------
// 2. MESAJ LOGLARI & MEDYA KURTARMA (Message Events)
// -------------------------------------------------------------
async function handleMessageDelete(message) {
  if (!message.guild || message.author?.bot) return;

  const guild = message.guild;
  const now = Date.now();

  // A. Ghost Ping (Hayalet Etiket) Tespiti
  const isRecent = message.createdTimestamp && (now - message.createdTimestamp < 60000);
  const hasMentions = message.mentions.users.size > 0 || message.mentions.roles.size > 0 || message.mentions.everyone;

  if (isRecent && hasMentions) {
    const targets = [
      ...message.mentions.users.map(u => `<@${u.id}>`),
      ...message.mentions.roles.map(r => `<@&${r.id}>`),
      message.mentions.everyone ? '@everyone / @here' : null
    ].filter(Boolean).join(', ');

    const ghostEmbed = new EmbedBuilder()
      .setColor(0xFF4500)
      .setTitle('👻 Hayalet Etiket (Ghost Ping) Yakalandı!')
      .setDescription(`<@${message.author.id}> (**${message.author.tag}**) birini etiketledikten **${Math.round((now - message.createdTimestamp) / 1000)} saniye** sonra mesajını sildi!`)
      .addFields(
        { name: '🎯 Etiketlenenler', value: targets || 'Bilinmiyor', inline: false },
        { name: '📍 Kanal', value: `<#${message.channel.id}>`, inline: true },
        { name: '💬 Silinen Mesaj', value: message.cleanContent || '*Boş veya sadece ek*', inline: false }
      )
      .setTimestamp();

    sendEmbed(guild, 'message_log', ghostEmbed);
  }

  // B. Silinen Medya Kurtarma (Anti-Delete Media)
  if (message.attachments.size > 0) {
    const recoveredFiles = [];

    for (const [_, att] of message.attachments) {
      try {
        const res = await fetch(att.url);
        if (res.ok) {
          const buffer = Buffer.from(await res.arrayBuffer());
          recoveredFiles.push(new AttachmentBuilder(buffer, { name: `kurtarilan_${att.name}` }));
        }
      } catch (e) {}
    }

    if (recoveredFiles.length > 0) {
      const mediaEmbed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('📸 Silinen Medya Kurtarıldı (Kanıt Dosyası)')
        .setDescription(`**Gönderen:** <@${message.author.id}> (**${message.author.tag}**)\n**Kanal:** <#${message.channel.id}>\n**İçerik:** ${message.cleanContent || '*Yalnızca medya gönderildi*'}`)
        .setFooter({ text: 'Beluga CDN Medya Kurtarma Motoru' })
        .setTimestamp();

      sendEmbed(guild, 'media_log', mediaEmbed, { files: recoveredFiles });
    }
  }

  // C. Standart Silinen Mesaj Kaydı
  const delEmbed = new EmbedBuilder()
    .setColor(0x36393F)
    .setTitle('🗑️ Mesaj Silindi')
    .addFields(
      { name: 'Yazar', value: `<@${message.author.id}> (${message.author.tag})`, inline: true },
      { name: 'Kanal', value: `<#${message.channel.id}>`, inline: true },
      { name: 'İçerik', value: message.cleanContent ? (message.cleanContent.length > 1000 ? message.cleanContent.slice(0, 1000) + '...' : message.cleanContent) : '*İçerik bulunamadı*' }
    )
    .setTimestamp();

  sendEmbed(guild, 'message_log', delEmbed);
}

async function handleMessageUpdate(oldMsg, newMsg) {
  if (!oldMsg.guild || oldMsg.author?.bot) return;
  if (oldMsg.content === newMsg.content) return;

  const embed = new EmbedBuilder()
    .setColor(0xFEE75C)
    .setTitle('✏️ Mesaj Düzenlendi')
    .setDescription(`[Mesaja Git](${newMsg.url})`)
    .addFields(
      { name: 'Yazar', value: `<@${oldMsg.author.id}> (${oldMsg.author.tag})`, inline: true },
      { name: 'Kanal', value: `<#${oldMsg.channel.id}>`, inline: true },
      { name: 'Eski Hali', value: oldMsg.content ? (oldMsg.content.length > 500 ? oldMsg.content.slice(0, 500) + '...' : oldMsg.content) : '*Boş*', inline: false },
      { name: 'Yeni Hali', value: newMsg.content ? (newMsg.content.length > 500 ? newMsg.content.slice(0, 500) + '...' : newMsg.content) : '*Boş*', inline: false }
    )
    .setTimestamp();

  sendEmbed(oldMsg.guild, 'message_log', embed);
}

// Toplu Mesaj Silme (Purge)
async function handleMessageDeleteBulk(messages, channel) {
  const guild = channel.guild;
  let executor = 'Yetkili';
  try {
    const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.MessageBulkDelete, limit: 1 });
    const entry = logs.entries.first();
    if (entry && entry.target.id === channel.id) executor = `<@${entry.executor.id}>`;
  } catch (e) {}

  const embed = new EmbedBuilder()
    .setColor(0xED4245)
    .setTitle('🧹 Toplu Mesaj Silindi (Purge)')
    .addFields(
      { name: 'Kanal', value: `<#${channel.id}> (${channel.name})`, inline: true },
      { name: 'Silinen Mesaj Sayısı', value: `\`${messages.size}\` adet`, inline: true },
      { name: 'İşlemi Yapan', value: executor, inline: true }
    )
    .setTimestamp();

  sendEmbed(guild, 'message_log', embed);
}

// -------------------------------------------------------------
// 3. ÜYE HAREKETLERİ LOGLARI (Member Events)
// -------------------------------------------------------------
async function handleMemberJoin(member) {
  const guild = member.guild;
  const now = Date.now();
  const createdAgeMs = now - member.user.createdTimestamp;
  const daysOld = Math.floor(createdAgeMs / (24 * 60 * 60 * 1000));
  const isSuspicious = daysOld < 15;

  // Davet eden kişi tespiti
  let inviterId = null;
  let usedCode = null;
  try {
    const currentInvites = await guild.invites.fetch();
    for (const [code, inv] of currentInvites) {
      const stored = db.prepare('SELECT uses FROM guild_invites WHERE guild_id = ? AND code = ?').get(guild.id, code);
      if (stored && inv.uses > stored.uses) {
        inviterId = inv.inviter?.id;
        usedCode = code;
        db.prepare('UPDATE guild_invites SET uses = ? WHERE guild_id = ? AND code = ?').run(inv.uses, guild.id, code);
        break;
      }
    }
  } catch (e) {}

  db.prepare('INSERT OR REPLACE INTO member_joins (guild_id, user_id, inviter_id, joined_at) VALUES (?, ?, ?, ?)')
    .run(guild.id, member.id, inviterId, now);

  const embed = new EmbedBuilder()
    .setColor(isSuspicious ? 0xFEE75C : 0x57F287)
    .setTitle(isSuspicious ? '⚠️ Şüpheli Yeni Hesap Katıldı' : '📥 Yeni Üye Katıldı')
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .addFields(
      { name: 'Üye', value: `<@${member.id}> (${member.user.tag})`, inline: true },
      { name: 'Hesap Yaşı', value: `**${daysOld}** gün önce açılmış (${isSuspicious ? '🚨 RİSKLİ' : 'Güvenli'})`, inline: true },
      { name: 'Davet Eden', value: inviterId ? `<@${inviterId}> (Kod: \`${usedCode}\`)` : 'Bilinmiyor / Özel URL', inline: true }
    )
    .setTimestamp();

  sendEmbed(guild, 'member_log', embed);

  if (isSuspicious) {
    const secEmbed = new EmbedBuilder()
      .setColor(0xFEE75C)
      .setTitle('⚠️ Güvenlik Uyarısı: Yeni Hesap Girişi')
      .setDescription(`<@${member.id}> (**${member.user.tag}**) hesabı yalnızca **${daysOld} günlük**. Olası bot/raid durumuna karşı takipte kalınması önerilir.`)
      .setTimestamp();
    sendEmbed(guild, 'security_log', secEmbed);
  }
}

async function handleMemberLeave(member) {
  const guild = member.guild;
  const now = Date.now();

  const joinRecord = db.prepare('SELECT * FROM member_joins WHERE guild_id = ? AND user_id = ?').get(guild.id, member.id);
  let durationStr = 'Bilinmiyor';
  let isFake = false;

  if (joinRecord) {
    const diff = now - joinRecord.joined_at;
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    const hours = Math.floor((diff / (60 * 60 * 1000)) % 24);
    const mins = Math.floor((diff / 60000) % 60);
    durationStr = `${days > 0 ? `${days} gün ` : ''}${hours} saat ${mins} dakika`;
    if (diff < (24 * 60 * 60 * 1000)) isFake = true; // 24 saatten az kaldıysa
  }

  const roles = member.roles.cache
    .filter(r => r.id !== guild.id)
    .map(r => `<@&${r.id}>`)
    .join(', ') || '*Rolü yoktu*';

  const embed = new EmbedBuilder()
    .setColor(0xED4245)
    .setTitle('📤 Üye Ayrıldı')
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .addFields(
      { name: 'Üye', value: `<@${member.id}> (${member.user.tag})`, inline: true },
      { name: 'Sunucudaki Süresi', value: durationStr, inline: true },
      { name: 'Ayrılırkenki Rolleri', value: roles, inline: false }
    )
    .setTimestamp();

  sendEmbed(guild, 'member_log', embed);

  // 24 saat dolmadan çıkan sahte davet alarmı
  if (isFake && joinRecord?.inviter_id) {
    const fakeEmbed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle('🚨 Sahte / Kaçak Davet Tespiti')
      .setDescription(`<@${member.id}> sunucudan 24 saat dolmadan ayrıldı.`)
      .addFields(
        { name: 'Davet Eden', value: `<@${joinRecord.inviter_id}>`, inline: true },
        { name: 'Kaldığı Süre', value: durationStr, inline: true }
      )
      .setFooter({ text: 'Davetçinin istatistiği düşürüldü' })
      .setTimestamp();

    sendEmbed(guild, 'member_log', fakeEmbed);
  }

  db.prepare('DELETE FROM member_joins WHERE guild_id = ? AND user_id = ?').run(guild.id, member.id);
}

// Üye Profil / Rol / Timeout Değişimi
async function handleMemberUpdate(oldMember, newMember) {
  const guild = newMember.guild;

  // A. Takma Ad (Nickname) Değişti
  if (oldMember.nickname !== newMember.nickname) {
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('✏️ Kullanıcı İsmi (Nickname) Değişti')
      .setDescription(`<@${newMember.id}> kullanıcısının sunucu takma adı güncellendi.`)
      .addFields(
        { name: 'Eski İsim', value: oldMember.nickname || oldMember.user.username, inline: true },
        { name: 'Yeni İsim', value: newMember.nickname || newMember.user.username, inline: true }
      )
      .setTimestamp();

    return sendEmbed(guild, 'member_log', embed);
  }

  // B. Roller Değişti (Eklendi / Kaldırıldı)
  const addedRoles = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
  const removedRoles = oldMember.roles.cache.filter(r => !newMember.roles.cache.has(r.id));

  if (addedRoles.size > 0 || removedRoles.size > 0) {
    let executor = 'Yetkili';
    try {
      const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberRoleUpdate, limit: 1 });
      const entry = logs.entries.first();
      if (entry && entry.target.id === newMember.id) executor = `<@${entry.executor.id}>`;
    } catch (e) {}

    const embed = new EmbedBuilder()
      .setColor(addedRoles.size > 0 ? 0x57F287 : 0xED4245)
      .setTitle(addedRoles.size > 0 ? '➕ Üyeye Rol Verildi' : '➖ Üyeden Rol Alındı')
      .setDescription(`<@${newMember.id}> (**${newMember.user.tag}**) rollerinde değişiklik yapıldı.`)
      .addFields(
        { name: 'İşlemi Yapan', value: executor, inline: true },
        { name: 'Değişen Roller', value: addedRoles.size > 0 ? addedRoles.map(r => `<@&${r.id}>`).join(', ') : removedRoles.map(r => `<@&${r.id}>`).join(', '), inline: false }
      )
      .setTimestamp();

    return sendEmbed(guild, 'member_log', embed);
  }

  // C. Zaman Aşımı (Timeout) Uygulandı / Kaldırıldı
  if (oldMember.communicationDisabledUntilTimestamp !== newMember.communicationDisabledUntilTimestamp) {
    const isTimeout = newMember.communicationDisabledUntilTimestamp && newMember.communicationDisabledUntilTimestamp > Date.now();
    let executor = 'Yetkili';
    let reason = 'Belirtilmedi';
    try {
      const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberUpdate, limit: 1 });
      const entry = logs.entries.first();
      if (entry && entry.target.id === newMember.id) {
        executor = `<@${entry.executor.id}>`;
        reason = entry.reason || 'Belirtilmedi';
      }
    } catch (e) {}

    const embed = new EmbedBuilder()
      .setColor(isTimeout ? 0xED4245 : 0x57F287)
      .setTitle(isTimeout ? '⏳ Üye Zaman Aşımına Uğratıldı (Timeout)' : '🔓 Zaman Aşımı Kaldırıldı')
      .setDescription(`<@${newMember.id}> (**${newMember.user.tag}**) kullanıcısına zaman aşımı işlemi yapıldı.`)
      .addFields(
        { name: 'İşlemi Yapan', value: executor, inline: true },
        { name: 'Bitiş Tarihi', value: isTimeout ? `<t:${Math.floor(newMember.communicationDisabledUntilTimestamp / 1000)}:R>` : 'Süre kaldırıldı', inline: true },
        { name: 'Sebep', value: reason, inline: false }
      )
      .setTimestamp();

    return sendEmbed(guild, 'member_log', embed);
  }
}

// Ban / Unban Olayları
async function handleGuildBanAdd(ban) {
  let executor = 'Yetkili';
  let reason = ban.reason || 'Belirtilmedi';
  try {
    const logs = await ban.guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanAdd, limit: 1 });
    const entry = logs.entries.first();
    if (entry && entry.target.id === ban.user.id) {
      executor = `<@${entry.executor.id}>`;
      if (entry.reason) reason = entry.reason;
    }
  } catch (e) {}

  const embed = new EmbedBuilder()
    .setColor(0x8B0000)
    .setTitle('🔨 Üye Sunucudan Yasaklandı (Ban)')
    .addFields(
      { name: 'Yasaklanan', value: `<@${ban.user.id}> (${ban.user.tag})`, inline: true },
      { name: 'Yasaklayan', value: executor, inline: true },
      { name: 'Sebep', value: reason, inline: false }
    )
    .setTimestamp();

  sendEmbed(ban.guild, 'member_log', embed);
}

async function handleGuildBanRemove(ban) {
  let executor = 'Yetkili';
  try {
    const logs = await ban.guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanRemove, limit: 1 });
    const entry = logs.entries.first();
    if (entry && entry.target.id === ban.user.id) executor = `<@${entry.executor.id}>`;
  } catch (e) {}

  const embed = new EmbedBuilder()
    .setColor(0x57F287)
    .setTitle('🔓 Üyenin Yasağı Kaldırıldı (Unban)')
    .addFields(
      { name: 'Yasağı Kalkan', value: `<@${ban.user.id}> (${ban.user.tag})`, inline: true },
      { name: 'Kaldıran Yetkili', value: executor, inline: true }
    )
    .setTimestamp();

  sendEmbed(ban.guild, 'member_log', embed);
}

// -------------------------------------------------------------
// 4. KANAL, ROL & SUNUCU LOGLARI (Server Events)
// -------------------------------------------------------------
async function handleChannelCreate(channel) {
  if (!channel.guild) return;
  let executor = 'Yetkili';
  try {
    const logs = await channel.guild.fetchAuditLogs({ type: AuditLogEvent.ChannelCreate, limit: 1 });
    const entry = logs.entries.first();
    if (entry && entry.target.id === channel.id) executor = `<@${entry.executor.id}>`;
  } catch (e) {}

  const embed = new EmbedBuilder()
    .setColor(0x57F287)
    .setTitle('📁 Yeni Kanal Oluşturuldu')
    .addFields(
      { name: 'Kanal', value: `<#${channel.id}> (${channel.name})`, inline: true },
      { name: 'Tür', value: `${channel.type}`, inline: true },
      { name: 'Oluşturan', value: executor, inline: true }
    )
    .setTimestamp();

  sendEmbed(channel.guild, 'server_log', embed);
}

async function handleChannelDelete(channel) {
  if (!channel.guild) return;
  let executor = 'Yetkili';
  try {
    const logs = await channel.guild.fetchAuditLogs({ type: AuditLogEvent.ChannelDelete, limit: 1 });
    const entry = logs.entries.first();
    if (entry && entry.target.id === channel.id) executor = `<@${entry.executor.id}>`;
  } catch (e) {}

  const embed = new EmbedBuilder()
    .setColor(0xED4245)
    .setTitle('🗑️ Kanal Silindi')
    .addFields(
      { name: 'Silinen Kanal', value: `\`#${channel.name}\``, inline: true },
      { name: 'Silen Yetkili', value: executor, inline: true }
    )
    .setTimestamp();

  sendEmbed(channel.guild, 'server_log', embed);
}

async function handleRoleCreate(role) {
  let executor = 'Yetkili';
  try {
    const logs = await role.guild.fetchAuditLogs({ type: AuditLogEvent.RoleCreate, limit: 1 });
    const entry = logs.entries.first();
    if (entry && entry.target.id === role.id) executor = `<@${entry.executor.id}>`;
  } catch (e) {}

  const embed = new EmbedBuilder()
    .setColor(0x57F287)
    .setTitle('🛡️ Yeni Rol Oluşturuldu')
    .addFields(
      { name: 'Rol', value: `<@&${role.id}> (${role.name})`, inline: true },
      { name: 'Oluşturan', value: executor, inline: true }
    )
    .setTimestamp();

  sendEmbed(role.guild, 'server_log', embed);
}

async function handleRoleDelete(role) {
  let executor = 'Yetkili';
  try {
    const logs = await role.guild.fetchAuditLogs({ type: AuditLogEvent.RoleDelete, limit: 1 });
    const entry = logs.entries.first();
    if (entry && entry.target.id === role.id) executor = `<@${entry.executor.id}>`;
  } catch (e) {}

  const embed = new EmbedBuilder()
    .setColor(0xED4245)
    .setTitle('🗑️ Rol Silindi')
    .addFields(
      { name: 'Silinen Rol', value: `\`@${role.name}\``, inline: true },
      { name: 'Silen Yetkili', value: executor, inline: true }
    )
    .setTimestamp();

  sendEmbed(role.guild, 'server_log', embed);
}

// Rol Güncellenmesi & KRİTİK YETKİ KIRMIZI ALARMI
async function handleRoleUpdate(oldRole, newRole) {
  const guild = newRole.guild;

  // 1. Kritik Yönetici İzinleri Kırmızı Alarmı
  const criticalPerms = [
    PermissionFlagsBits.Administrator,
    PermissionFlagsBits.ManageGuild,
    PermissionFlagsBits.ManageRoles,
    PermissionFlagsBits.BanMembers,
    PermissionFlagsBits.KickMembers
  ];

  const gainedPerms = criticalPerms.filter(perm => !oldRole.permissions.has(perm) && newRole.permissions.has(perm));

  if (gainedPerms.length > 0) {
    let executor = 'Yetkili';
    try {
      const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.RoleUpdate, limit: 1 });
      const entry = logs.entries.first();
      if (entry && entry.target.id === newRole.id) executor = `<@${entry.executor.id}> (${entry.executor.tag})`;
    } catch (e) {}

    const redAlertEmbed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('🚨 KRİTİK ROL İZNİ KIRMIZI ALARMI')
      .setDescription(`**<@&${newRole.id}>** rolüne yüksek riskli yönetici/moderasyon izinleri verildi!`)
      .addFields(
        { name: 'İşlemi Yapan', value: executor, inline: true },
        { name: 'Rol', value: `<@&${newRole.id}>`, inline: true },
        { name: 'Eklenen Kritik İzin Sayısı', value: `${gainedPerms.length} adet tehlikeli yetki`, inline: false }
      )
      .setFooter({ text: 'Acil Durum Denetim Bildirimi' })
      .setTimestamp();

    sendEmbed(guild, 'security_log', redAlertEmbed, { content: '@everyone' });
  }

  // 2. Normal Rol Güncelleme Logu
  if (oldRole.name !== newRole.name || oldRole.color !== newRole.color) {
    const embed = new EmbedBuilder()
      .setColor(0xFEE75C)
      .setTitle('✏️ Rol Güncellendi')
      .setDescription(`<@&${newRole.id}> rolünün özellikleri değiştirildi.`)
      .addFields(
        { name: 'Eski İsim', value: oldRole.name, inline: true },
        { name: 'Yeni İsim', value: newRole.name, inline: true }
      )
      .setTimestamp();

    sendEmbed(guild, 'server_log', embed);
  }
}

// Anti-Nuke (10 Saniyede Seri Kanal veya Rol Silme Koruması)
async function checkAntiNuke(guild, actionType) {
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

    if (recent.length >= 2) {
      nukeTracker.delete(executorId);
      const member = await guild.members.fetch(executorId).catch(() => null);

      if (member) {
        await member.roles.set([], 'Anti-Nuke Seri Silme Koruması Tetiklendi').catch(() => null);

        const alertEmbed = new EmbedBuilder()
          .setColor(0x8B0000)
          .setTitle('🛡️ ANTI-NUKE SALDIRI ENGELİ')
          .setDescription(`🚨 <@${executorId}> 10 saniye içinde birden fazla kanal/rol silmeye çalıştığı için **tüm rolleri alındı ve yetkileri sıfırlandı!**`)
          .setTimestamp();

        sendEmbed(guild, 'security_log', alertEmbed, { content: `<@${guild.ownerId}>` });
      }
    }
  } catch (err) {
    console.error('Anti-Nuke kontrol hatası:', err);
  }
}

module.exports = {
  handleVoiceState,
  handleMessageDelete,
  handleMessageUpdate,
  handleMessageDeleteBulk,
  handleMemberJoin,
  handleMemberLeave,
  handleMemberUpdate,
  handleGuildBanAdd,
  handleGuildBanRemove,
  handleChannelCreate,
  handleChannelDelete,
  handleRoleCreate,
  handleRoleDelete,
  handleRoleUpdate,
  checkAntiNuke
};

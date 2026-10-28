const {
  ChannelType,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  UserSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder
} = require('discord.js');
const { db, getSettings } = require('../../database/db');

// İsim değiştirme rate-limit hafızası (5 dakika cooldown)
const renameCooldowns = new Map(); // channelId -> timestamp

function getControlPanelComponents(isClaimable = false) {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('tv_lock').setLabel('Kilitle / Aç').setEmoji('🔒').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('tv_invisible').setLabel('Gizle / Göster').setEmoji('👁️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('tv_chat_lock').setLabel('Sohbet Kilidi').setEmoji('💬').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('tv_rename').setLabel('İsim Değiştir').setEmoji('✏️').setStyle(ButtonStyle.Primary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('tv_trust').setLabel('Güven (Trust)').setEmoji('🤝').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('tv_block').setLabel('Engelle (Block)').setEmoji('🚫').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('tv_soundboard').setLabel('Ses Efekti İzni').setEmoji('🎵').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('tv_limit_menu').setLabel('Kişi Limiti').setEmoji('👥').setStyle(ButtonStyle.Primary)
  );

  const rows = [row1, row2];

  if (isClaimable) {
    const claimRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('tv_claim').setLabel('👑 Sahipliği Al (Claim)').setStyle(ButtonStyle.Success)
    );
    rows.push(claimRow);
  }

  return rows;
}

function getControlPanelEmbed(ownerTag, isClaimable = false) {
  return new EmbedBuilder()
    .setColor(isClaimable ? 0xFFA500 : 0x5865F2)
    .setTitle('🎙️ Geçici Ses Odası Kontrol Paneli')
    .setDescription(
      isClaimable
        ? `⚠️ **Oda sahibi ayrıldı!** Aşağıdaki **"👑 Sahipliği Al"** butonuna basarak odanın yeni yöneticisi olabilirsiniz.`
        : `Hoş geldin! Odanın tüm kontrolü sende. Aşağıdaki butonlarla odanı dilediğin gibi özelleştirebilirsin.\n\n👑 **Oda Sahibi:** ${ownerTag}`
    )
    .addFields(
      { name: '🔒 Kilitle / Gizle', value: 'Girişleri ve görünürlüğü kapatın.', inline: true },
      { name: '👥 Limit & Güvenlik', value: 'Kapasite belirleyin, istenmeyenleri atıp engelleyin.', inline: true },
      { name: '✏️ İsim & Ses', value: 'Oda adını değiştirin (5 dk sınır), soundboard izinlerini yönetin.', inline: true }
    )
    .setFooter({ text: 'Beluga Temp Voice UI • Sıfır Çöp Kanal Prensibi' });
}

async function handleVoiceStateUpdate(oldState, newState) {
  const guild = newState.guild;
  const settings = getSettings(guild.id);
  if (!settings.temp_voice_channel_id) return;

  // 1. Odaya Katılma (Yeni Geçici Oda Oluşturma)
  if (newState.channelId === settings.temp_voice_channel_id && newState.member) {
    const member = newState.member;

    // Kullanıcı tercihini çek
    const pref = db.prepare('SELECT * FROM temp_voice_preferences WHERE guild_id = ? AND user_id = ?')
      .get(guild.id, member.id);

    const baseName = pref && pref.channel_name ? pref.channel_name : (settings.temp_voice_name_template || `🔊 {user}'nin Odası`).replace('{user}', member.displayName);
    const initialLock = pref ? pref.is_locked : 0;
    const initialLimit = pref ? pref.user_limit : 0;

    try {
      const channel = await guild.channels.create({
        name: baseName,
        type: ChannelType.GuildVoice,
        parent: settings.temp_voice_category_id || undefined,
        userLimit: initialLimit,
        permissionOverwrites: [
          {
            id: guild.id, // @everyone
            allow: [PermissionFlagsBits.ViewChannel],
            deny: initialLock ? [PermissionFlagsBits.Connect] : []
          },
          {
            id: member.id, // Oda sahibi
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.Connect,
              PermissionFlagsBits.Speak,
              PermissionFlagsBits.MoveMembers,
              PermissionFlagsBits.ManageChannels
            ]
          }
        ]
      });

      // Kullanıcıyı yeni odaya taşı
      await member.voice.setChannel(channel);

      // Veritabanına kaydet
      db.prepare(`
        INSERT INTO temp_voices (channel_id, guild_id, owner_id, created_at, is_locked, user_limit)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(channel.id, guild.id, member.id, Date.now(), initialLock, initialLimit);

      // Kontrol Paneli Mesajını odaya gönder
      const controlMsg = await channel.send({
        embeds: [getControlPanelEmbed(member.user.tag, false)],
        components: getControlPanelComponents(false)
      }).catch(() => null);

      if (controlMsg) {
        db.prepare('UPDATE temp_voices SET control_message_id = ? WHERE channel_id = ?')
          .run(controlMsg.id, channel.id);
      }
    } catch (err) {
      console.error('Geçici ses odası oluşturulamadı:', err);
    }
  }

  // 2. Odadan Ayrılma (Temizlik veya Sahiplik Devri)
  if (oldState.channelId && oldState.channelId !== settings.temp_voice_channel_id) {
    const tempRoom = db.prepare('SELECT * FROM temp_voices WHERE channel_id = ?').get(oldState.channelId);
    if (!tempRoom) return;

    const oldChannel = oldState.channel;
    if (!oldChannel) return;

    // Odada hiç kimse kalmadıysa -> Sıfır Çöp Prensibiyle Sil
    if (oldChannel.members.size === 0) {
      db.prepare('DELETE FROM temp_voices WHERE channel_id = ?').run(oldChannel.id);
      renameCooldowns.delete(oldChannel.id);
      await oldChannel.delete().catch(() => null);
      return;
    }

    // Oda sahibi çıktı ama odada başka üyeler varsa -> Claim (Sahiplik Devri) Butonunu Aç
    if (oldState.id === tempRoom.owner_id) {
      if (tempRoom.control_message_id) {
        try {
          const msg = await oldChannel.messages.fetch(tempRoom.control_message_id).catch(() => null);
          if (msg) {
            await msg.edit({
              embeds: [getControlPanelEmbed('Sahipsiz Oda', true)],
              components: getControlPanelComponents(true)
            });
          }
        } catch (e) {}
      }
    }
  }
}

async function handleTempVoiceInteraction(interaction) {
  const customId = interaction.customId;
  const channel = interaction.channel;
  if (!channel || channel.type !== ChannelType.GuildVoice) return;

  const room = db.prepare('SELECT * FROM temp_voices WHERE channel_id = ?').get(channel.id);
  if (!room) return;

  const member = interaction.member;

  // 1. Sahipliği Devralma (Claim)
  if (customId === 'tv_claim') {
    if (room.owner_id === member.id) {
      return interaction.reply({ content: 'Zaten odanın sahibisiniz!', ephemeral: true });
    }

    // Yeni sahip yap
    db.prepare('UPDATE temp_voices SET owner_id = ? WHERE channel_id = ?').run(member.id, channel.id);
    
    // İzinleri devret
    await channel.permissionOverwrites.edit(member.id, {
      ViewChannel: true,
      Connect: true,
      Speak: true,
      MoveMembers: true,
      ManageChannels: true
    });

    // Kontrol panelini normale çevir
    const components = getControlPanelComponents(false);
    const embed = getControlPanelEmbed(member.user.tag, false);
    if (room.control_message_id) {
      const msg = await channel.messages.fetch(room.control_message_id).catch(() => null);
      if (msg) await msg.edit({ embeds: [embed], components });
    }

    return interaction.reply({ content: `👑 Tebrikler <@${member.id}>, odanın yeni sahibi siz oldunuz!`, ephemeral: false });
  }

  // Sahip kontrolü (Diğer tüm butonlar için sahip olmak şart)
  if (room.owner_id !== member.id) {
    return interaction.reply({ content: '⛔ Bu odayı yalnızca oda sahibi yönetebilir!', ephemeral: true });
  }

  // 2. Kilitle / Aç (Lock/Unlock)
  if (customId === 'tv_lock') {
    const isLocked = !room.is_locked;
    db.prepare('UPDATE temp_voices SET is_locked = ? WHERE channel_id = ?').run(isLocked ? 1 : 0, channel.id);
    db.prepare('INSERT OR REPLACE INTO temp_voice_preferences (guild_id, user_id, is_locked) VALUES (?, ?, ?)')
      .run(channel.guild.id, member.id, isLocked ? 1 : 0);

    await channel.permissionOverwrites.edit(channel.guild.id, {
      Connect: isLocked ? false : null
    });

    return interaction.reply({ content: isLocked ? '🔒 Oda kilitlendi. Yalnızca izin verdiğiniz üyeler girebilir.' : '🔓 Oda kilidi açıldı. Herkes katılabilir.', ephemeral: true });
  }

  // 3. Gizle / Göster (Invisible/Visible)
  if (customId === 'tv_invisible') {
    const isHidden = !room.is_hidden;
    db.prepare('UPDATE temp_voices SET is_hidden = ? WHERE channel_id = ?').run(isHidden ? 1 : 0, channel.id);

    await channel.permissionOverwrites.edit(channel.guild.id, {
      ViewChannel: isHidden ? false : true
    });

    return interaction.reply({ content: isHidden ? '👁️ Oda listeden gizlendi.' : '👁️ Oda tekrar görünür yapıldı.', ephemeral: true });
  }

  // 4. Sohbet Kilidi
  if (customId === 'tv_chat_lock') {
    const textLocked = !room.text_locked;
    db.prepare('UPDATE temp_voices SET text_locked = ? WHERE channel_id = ?').run(textLocked ? 1 : 0, channel.id);

    await channel.permissionOverwrites.edit(channel.guild.id, {
      SendMessages: textLocked ? false : null
    });

    return interaction.reply({ content: textLocked ? '💬 Oda içi metin sohbeti kilitlendi.' : '💬 Oda içi metin sohbeti açıldı.', ephemeral: true });
  }

  // 5. Kişi Limiti Menüsü
  if (customId === 'tv_limit_menu') {
    const select = new StringSelectMenuBuilder()
      .setCustomId('tv_set_limit')
      .setPlaceholder('Oda için kişi limiti seçin')
      .addOptions([
        { label: 'Limitsiz Kapasite', value: '0', description: 'Giriş sınırı yok' },
        { label: '2 Kişilik (Duo)', value: '2', description: 'Maksimum 2 kişi' },
        { label: '3 Kişilik (Trio)', value: '3', description: 'Maksimum 3 kişi' },
        { label: '5 Kişilik (Squad)', value: '5', description: 'Maksimum 5 kişi' },
        { label: '10 Kişilik', value: '10', description: 'Maksimum 10 kişi' }
      ]);

    return interaction.reply({
      content: '👥 Odanız için maksimum kullanıcı kapasitesini belirleyin:',
      components: [new ActionRowBuilder().addComponents(select)],
      ephemeral: true
    });
  }

  if (customId === 'tv_set_limit') {
    const limit = parseInt(interaction.values[0], 10);
    await channel.setUserLimit(limit);
    db.prepare('UPDATE temp_voices SET user_limit = ? WHERE channel_id = ?').run(limit, channel.id);
    db.prepare('INSERT OR REPLACE INTO temp_voice_preferences (guild_id, user_id, user_limit) VALUES (?, ?, ?)')
      .run(channel.guild.id, member.id, limit);

    return interaction.update({ content: `✅ Oda kapasitesi **${limit === 0 ? 'Limitsiz' : limit + ' Kişi'}** olarak ayarlandı.`, components: [] });
  }

  // 6. Güven (Trust) Seçici
  if (customId === 'tv_trust') {
    const userSelect = new UserSelectMenuBuilder()
      .setCustomId('tv_select_trust')
      .setPlaceholder('Güvenilecek üyeyi seçin');

    return interaction.reply({
      content: '🤝 Oda kilitli olsa dahi serbestçe katılabilecek üyeyi seçin:',
      components: [new ActionRowBuilder().addComponents(userSelect)],
      ephemeral: true
    });
  }

  if (customId === 'tv_select_trust') {
    const targetUserId = interaction.values[0];
    await channel.permissionOverwrites.edit(targetUserId, {
      Connect: true,
      ViewChannel: true
    });

    return interaction.update({ content: `✅ <@${targetUserId}> artık odanıza serbestçe girebilir.`, components: [] });
  }

  // 7. Engelle (Block) Seçici
  if (customId === 'tv_block') {
    const userSelect = new UserSelectMenuBuilder()
      .setCustomId('tv_select_block')
      .setPlaceholder('Engellenecek üyeyi seçin');

    return interaction.reply({
      content: '🚫 Odadan atılıp tekrar girmesi yasaklanacak üyeyi seçin:',
      components: [new ActionRowBuilder().addComponents(userSelect)],
      ephemeral: true
    });
  }

  if (customId === 'tv_select_block') {
    const targetUserId = interaction.values[0];
    const targetMember = await interaction.guild.members.fetch(targetUserId).catch(() => null);

    // Odadaysa dışarı at
    if (targetMember && targetMember.voice.channelId === channel.id) {
      await targetMember.voice.disconnect('Oda sahibi tarafından engellendi.').catch(() => null);
    }

    // Tekrar girmesini engelle
    await channel.permissionOverwrites.edit(targetUserId, {
      Connect: false,
      ViewChannel: false
    });

    return interaction.update({ content: `🚫 <@${targetUserId}> odadan uzaklaştırıldı ve girişi engellendi.`, components: [] });
  }

  // 8. İsim Değiştir Modal (5 dk Cooldown Korumalı)
  if (customId === 'tv_rename') {
    const lastRename = renameCooldowns.get(channel.id) || 0;
    const now = Date.now();
    const cooldown = 5 * 60 * 1000;

    if (now - lastRename < cooldown) {
      const remainingSec = Math.ceil((cooldown - (now - lastRename)) / 1000);
      return interaction.reply({ content: `⏳ Discord sınırları gereği oda ismini **${remainingSec} saniye** sonra tekrar değiştirebilirsiniz.`, ephemeral: true });
    }

    const modal = new ModalBuilder()
      .setCustomId('tv_modal_rename')
      .setTitle('Oda İsmini Değiştir');

    const nameInput = new TextInputBuilder()
      .setCustomId('new_name')
      .setLabel('Yeni Oda İsmi')
      .setStyle(TextInputStyle.Short)
      .setMaxLength(30)
      .setRequired(true)
      .setValue(channel.name);

    modal.addComponents(new ActionRowBuilder().addComponents(nameInput));
    return interaction.showModal(modal);
  }

  // 9. Soundboard İzni Aç / Kapat
  if (customId === 'tv_soundboard') {
    const currentPerms = channel.permissionsFor(channel.guild.id);
    const hasSoundboard = currentPerms.has(PermissionFlagsBits.UseSoundboard);

    await channel.permissionOverwrites.edit(channel.guild.id, {
      UseSoundboard: hasSoundboard ? false : true,
      UseExternalSounds: hasSoundboard ? false : true
    });

    return interaction.reply({
      content: hasSoundboard ? '🔇 Misafirler için ses efektleri (Soundboard) kapatıldı.' : '🎵 Misafirler için ses efektleri serbest bırakıldı.',
      ephemeral: true
    });
  }
}

// Modal Yanıtı (İsim Değiştirme)
async function handleTempVoiceModal(interaction) {
  if (interaction.customId === 'tv_modal_rename') {
    const channel = interaction.channel;
    const newName = interaction.fields.getTextInputValue('new_name');

    renameCooldowns.set(channel.id, Date.now());
    await channel.setName(newName);

    // Tercihlere kaydet
    db.prepare('INSERT OR REPLACE INTO temp_voice_preferences (guild_id, user_id, channel_name) VALUES (?, ?, ?)')
      .run(channel.guild.id, interaction.user.id, newName);

    return interaction.reply({ content: `✅ Oda ismi başarıyla **"${newName}"** olarak güncellendi ve hafızaya kaydedildi.`, ephemeral: true });
  }
}

// Bot Açılışında Hayalet Odaları Temizleme
async function cleanupGhostTempRooms(client) {
  const rooms = db.prepare('SELECT * FROM temp_voices').all();
  for (const r of rooms) {
    try {
      const channel = client.channels.cache.get(r.channel_id) || await client.channels.fetch(r.channel_id).catch(() => null);
      if (!channel) {
        db.prepare('DELETE FROM temp_voices WHERE channel_id = ?').run(r.channel_id);
      } else if (channel.isVoiceBased() && channel.members.size === 0) {
        db.prepare('DELETE FROM temp_voices WHERE channel_id = ?').run(r.channel_id);
        await channel.delete().catch(() => null);
      }
    } catch (e) {
      db.prepare('DELETE FROM temp_voices WHERE channel_id = ?').run(r.channel_id);
    }
  }
}

module.exports = {
  handleVoiceStateUpdate,
  handleTempVoiceInteraction,
  handleTempVoiceModal,
  cleanupGhostTempRooms,
  getControlPanelEmbed,
  getControlPanelComponents
};


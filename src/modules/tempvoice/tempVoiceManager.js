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
const { db, getLogChannels } = require('../../database/db');

// İsim değiştirme cooldown (5 dakika)
const renameCooldowns = new Map();

function getControlPanelComponents(room, isClaimable = false) {
  // 1. Açılır Menü (Select Menu)
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('tv_select_action')
    .setPlaceholder('⚙️ Odanız için bir işlem seçin...')
    .addOptions([
      { label: room.is_locked ? '🔓 Odanın Kilidini Aç' : '🔒 Odayı Kilitle', value: 'action_toggle_lock', description: 'Giriş izinlerini açar/kapatır' },
      { label: room.is_hidden ? '👁️ Odayı Görünür Yap' : '👁️ Odayı Gizle', value: 'action_toggle_hide', description: 'Odanın kanallar listesinde görünürlüğü' },
      { label: '👥 Kişi Limitini Ayarla', value: 'action_set_limit', description: 'Odaya girebilecek kişi sayısı' },
      { label: '🤝 Güvenilen Üye Ekle (Trust)', value: 'action_trust', description: 'Kilitli olsa da odaya girebilme izni' },
      { label: '🚫 Üye Engelle (Block)', value: 'action_block', description: 'Odadan atar ve tekrar girişini yasaklar' },
      { label: '✏️ Oda İsmini Değiştir', value: 'action_rename', description: 'Odanın adını değiştirir' }
    ]);

  // 2. Butonlar (Hızlı İşlem Butonları)
  const buttonRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('tv_btn_lock')
      .setLabel(room.is_locked ? 'Kilitli 🔒' : 'Açık 🔓')
      .setStyle(room.is_locked ? ButtonStyle.Danger : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('tv_btn_hide')
      .setLabel(room.is_hidden ? 'Gizli 👁️' : 'Görünür 👁️')
      .setStyle(room.is_hidden ? ButtonStyle.Danger : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('tv_btn_limit')
      .setLabel('👥 Limit')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('tv_btn_rename')
      .setLabel('✏️ İsim')
      .setStyle(ButtonStyle.Primary)
  );

  const rows = [new ActionRowBuilder().addComponents(selectMenu), buttonRow];

  if (isClaimable) {
    const claimRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('tv_btn_claim')
        .setLabel('👑 Odanın Sahipliğini Al (Claim)')
        .setStyle(ButtonStyle.Success)
    );
    rows.push(claimRow);
  }

  return rows;
}

function getControlPanelEmbed(ownerTag, room, isClaimable = false) {
  const lockStatus = room.is_locked ? '🔒 Kilitli' : '🔓 Açık (Herkes Girebilir)';
  const hideStatus = room.is_hidden ? '👁️ Gizli (Listede Görünmez)' : '👁️ Görünür';
  const limitStatus = room.user_limit > 0 ? `${room.user_limit} Kişi` : 'Limitsiz';

  return new EmbedBuilder()
    .setColor(isClaimable ? 0xFFA500 : 0x2B2D31)
    .setTitle('🎙️ Geçici Ses Odası Yönetim Paneli')
    .setDescription(
      isClaimable
        ? `⚠️ **Oda kurucusu ayrıldı!** Aşağıdaki butona basarak odanın yeni yöneticisi olabilirsiniz.`
        : `Hoş geldin! Odanın tüm kontrolü sende.\nAşağıdaki **açılır menü** veya **butonları** kullanarak odanı yönetebilirsin.\n\n` +
          `👑 **Oda Yöneticisi:** ${ownerTag}\n` +
          `• **Kilit Durumu:** \`${lockStatus}\`\n` +
          `• **Görünürlük:** \`${hideStatus}\`\n` +
          `• **Kişi Kapasitesi:** \`${limitStatus}\``
    )
    .setFooter({ text: 'Sıfır Çöp Prensibi: Odadan herkes çıktığında kanal otomatik silinir.' });
}

// Ses Kanalı Hareketi (Oda Açma & Çıkışta Temizleme)
async function handleTempVoice(oldState, newState) {
  const guild = newState.guild;
  const settings = getLogChannels(guild.id);
  if (!settings.temp_voice_channel_id) return;

  // 1. Odaya Katılma (Yeni Geçici Oda Aç)
  if (newState.channelId === settings.temp_voice_channel_id && newState.member) {
    const member = newState.member;
    const roomName = `🔊 ${member.displayName.slice(0, 15)}'in Odası`;

    try {
      const channel = await guild.channels.create({
        name: roomName,
        type: ChannelType.GuildVoice,
        parent: settings.temp_voice_category_id || undefined,
        permissionOverwrites: [
          {
            id: guild.id, // @everyone
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.Connect,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory
            ]
          },
          {
            id: member.id, // Oda Kurucusu
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.Connect,
              PermissionFlagsBits.Speak,
              PermissionFlagsBits.MoveMembers,
              PermissionFlagsBits.ManageChannels,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory
            ]
          },
          {
            id: guild.client.user.id, // Bot
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.Connect,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.EmbedLinks,
              PermissionFlagsBits.ManageChannels
            ]
          }
        ]
      });

      // Kullanıcıyı yeni odaya taşı
      await member.voice.setChannel(channel);

      // Veritabanına kaydet
      db.prepare(`
        INSERT INTO temp_voices (channel_id, guild_id, owner_id, created_at, is_locked, is_hidden, user_limit)
        VALUES (?, ?, ?, ?, 0, 0, 0)
      `).run(channel.id, guild.id, member.id, Date.now());

      const roomData = { is_locked: 0, is_hidden: 0, user_limit: 0 };

      // Odanın dahili metin sohbetine hem butonlu hem menülü kontrol panelini gönder
      const controlMsg = await channel.send({
        embeds: [getControlPanelEmbed(member.user.tag, roomData, false)],
        components: getControlPanelComponents(roomData, false)
      }).catch(() => null);

      if (controlMsg) {
        db.prepare('UPDATE temp_voices SET control_message_id = ? WHERE channel_id = ?')
          .run(controlMsg.id, channel.id);
      }
    } catch (err) {
      console.error('Geçici ses odası oluşturulamadı:', err);
    }
  }

  // 2. Odadan Ayrılma (Sıfır Çöp Temizliği & Sahiplik Devri)
  if (oldState.channelId && oldState.channelId !== settings.temp_voice_channel_id) {
    const room = db.prepare('SELECT * FROM temp_voices WHERE channel_id = ?').get(oldState.channelId);
    if (!room) return;

    const oldChannel = oldState.channel;
    if (!oldChannel) return;

    // Odada hiç kimse kalmadıysa ➔ ANINDA SİL
    if (oldChannel.members.size === 0) {
      db.prepare('DELETE FROM temp_voices WHERE channel_id = ?').run(oldChannel.id);
      renameCooldowns.delete(oldChannel.id);
      await oldChannel.delete().catch(() => null);
      return;
    }

    // Oda sahibi çıktı ama odada başka üyeler varsa ➔ Sahiplik Al (Claim) Butonunu Göster
    if (oldState.id === room.owner_id) {
      if (room.control_message_id) {
        try {
          const msg = await oldChannel.messages.fetch(room.control_message_id).catch(() => null);
          if (msg) {
            await msg.edit({
              embeds: [getControlPanelEmbed('Sahipsiz Oda', room, true)],
              components: getControlPanelComponents(room, true)
            });
          }
        } catch (e) {}
      }
    }
  }
}

// Etkileşim Yöneticisi (Hem Menü Hem Butonlar)
async function handleTempVoiceInteraction(interaction) {
  const customId = interaction.customId;
  const channel = interaction.channel;
  if (!channel || channel.type !== ChannelType.GuildVoice) return;

  const room = db.prepare('SELECT * FROM temp_voices WHERE channel_id = ?').get(channel.id);
  if (!room) return;

  const member = interaction.member;

  // A. Sahipliği Devralma (Claim)
  if (customId === 'tv_btn_claim') {
    if (room.owner_id === member.id) {
      return interaction.reply({ content: 'Zaten odanın sahibisiniz!', ephemeral: true });
    }

    db.prepare('UPDATE temp_voices SET owner_id = ? WHERE channel_id = ?').run(member.id, channel.id);

    await channel.permissionOverwrites.edit(member.id, {
      ViewChannel: true,
      Connect: true,
      Speak: true,
      MoveMembers: true,
      ManageChannels: true
    });

    const updatedRoom = db.prepare('SELECT * FROM temp_voices WHERE channel_id = ?').get(channel.id);
    const components = getControlPanelComponents(updatedRoom, false);
    const embed = getControlPanelEmbed(member.user.tag, updatedRoom, false);

    if (room.control_message_id) {
      const msg = await channel.messages.fetch(room.control_message_id).catch(() => null);
      if (msg) await msg.edit({ embeds: [embed], components });
    }

    return interaction.reply({ content: `👑 Odanın yeni yöneticisi <@${member.id}> oldu!`, ephemeral: false });
  }

  // Yalnızca oda sahibi yönetebilir
  if (room.owner_id !== member.id) {
    return interaction.reply({ content: '⛔ Bu odayı yalnızca oda sahibi yönetebilir!', ephemeral: true });
  }

  // Yardımcı UI Güncelleyici
  const refreshPanel = async (newRoom) => {
    if (room.control_message_id) {
      const msg = await channel.messages.fetch(room.control_message_id).catch(() => null);
      if (msg) {
        await msg.edit({
          embeds: [getControlPanelEmbed(member.user.tag, newRoom, false)],
          components: getControlPanelComponents(newRoom, false)
        });
      }
    }
  };

  // 1. KİLİTLE / AÇ
  if (customId === 'tv_btn_lock' || (customId === 'tv_select_action' && interaction.values[0] === 'action_toggle_lock')) {
    const isLocked = !room.is_locked;
    db.prepare('UPDATE temp_voices SET is_locked = ? WHERE channel_id = ?').run(isLocked ? 1 : 0, channel.id);

    await channel.permissionOverwrites.edit(channel.guild.id, {
      Connect: isLocked ? false : null
    });

    const newRoom = { ...room, is_locked: isLocked ? 1 : 0 };
    await refreshPanel(newRoom);

    return interaction.reply({
      content: isLocked ? '🔒 Oda kilitlendi. Yalnızca izin verilenler katılabilir.' : '🔓 Oda kilidi açıldı. Herkes katılabilir.',
      ephemeral: true
    });
  }

  // 2. GİZLE / GÖSTER
  if (customId === 'tv_btn_hide' || (customId === 'tv_select_action' && interaction.values[0] === 'action_toggle_hide')) {
    const isHidden = !room.is_hidden;
    db.prepare('UPDATE temp_voices SET is_hidden = ? WHERE channel_id = ?').run(isHidden ? 1 : 0, channel.id);

    await channel.permissionOverwrites.edit(channel.guild.id, {
      ViewChannel: isHidden ? false : true
    });

    const newRoom = { ...room, is_hidden: isHidden ? 1 : 0 };
    await refreshPanel(newRoom);

    return interaction.reply({
      content: isHidden ? '👁️ Oda kanal listesinden gizlendi.' : '👁️ Oda tekrar görünür yapıldı.',
      ephemeral: true
    });
  }

  // 3. KİŞİ LİMİTİ SEÇİCİSİ
  if (customId === 'tv_btn_limit' || (customId === 'tv_select_action' && interaction.values[0] === 'action_set_limit')) {
    const select = new StringSelectMenuBuilder()
      .setCustomId('tv_set_limit_choice')
      .setPlaceholder('Kişi limitini seçin...')
      .addOptions([
        { label: 'Limitsiz Kapasite', value: '0', description: 'Giriş sınırı yok' },
        { label: '2 Kişilik (Duo)', value: '2', description: 'Maksimum 2 kişi' },
        { label: '3 Kişilik (Trio)', value: '3', description: 'Maksimum 3 kişi' },
        { label: '5 Kişilik (Squad)', value: '5', description: 'Maksimum 5 kişi' },
        { label: '10 Kişilik', value: '10', description: 'Maksimum 10 kişi' }
      ]);

    return interaction.reply({
      content: '👥 Odanız için maksimum kişi sayısını seçin:',
      components: [new ActionRowBuilder().addComponents(select)],
      ephemeral: true
    });
  }

  if (customId === 'tv_set_limit_choice') {
    const limit = parseInt(interaction.values[0], 10);
    await channel.setUserLimit(limit);
    db.prepare('UPDATE temp_voices SET user_limit = ? WHERE channel_id = ?').run(limit, channel.id);

    const newRoom = { ...room, user_limit: limit };
    await refreshPanel(newRoom);

    return interaction.update({ content: `✅ Oda kapasitesi **${limit === 0 ? 'Limitsiz' : limit + ' Kişi'}** olarak ayarlandı.`, components: [] });
  }

  // 4. GÜVEN (TRUST)
  if (customId === 'tv_select_action' && interaction.values[0] === 'action_trust') {
    const userSelect = new UserSelectMenuBuilder()
      .setCustomId('tv_apply_trust')
      .setPlaceholder('Güvenilecek üyeyi seçin...');

    return interaction.reply({
      content: '🤝 Oda kilitli olsa dahi serbestçe katılabilecek üyeyi seçin:',
      components: [new ActionRowBuilder().addComponents(userSelect)],
      ephemeral: true
    });
  }

  if (customId === 'tv_apply_trust') {
    const targetUserId = interaction.values[0];
    await channel.permissionOverwrites.edit(targetUserId, { Connect: true, ViewChannel: true });
    return interaction.update({ content: `✅ <@${targetUserId}> artık kilitli olsa da odanıza girebilir.`, components: [] });
  }

  // 5. ENGELLE (BLOCK)
  if (customId === 'tv_select_action' && interaction.values[0] === 'action_block') {
    const userSelect = new UserSelectMenuBuilder()
      .setCustomId('tv_apply_block')
      .setPlaceholder('Engellenecek üyeyi seçin...');

    return interaction.reply({
      content: '🚫 Odadan atılıp girişi engellenecek üyeyi seçin:',
      components: [new ActionRowBuilder().addComponents(userSelect)],
      ephemeral: true
    });
  }

  if (customId === 'tv_apply_block') {
    const targetUserId = interaction.values[0];
    const targetMember = await interaction.guild.members.fetch(targetUserId).catch(() => null);

    if (targetMember && targetMember.voice.channelId === channel.id) {
      await targetMember.voice.disconnect('Oda yöneticisi tarafından engellendi.').catch(() => null);
    }

    await channel.permissionOverwrites.edit(targetUserId, { Connect: false, ViewChannel: false });
    return interaction.update({ content: `🚫 <@${targetUserId}> odadan çıkarıldı ve girişi engellendi.`, components: [] });
  }

  // 6. İSİM DEĞİŞTİR (MODAL)
  if (customId === 'tv_btn_rename' || (customId === 'tv_select_action' && interaction.values[0] === 'action_rename')) {
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
}

// İsim Değiştir Modal Yanıtı
async function handleTempVoiceModal(interaction) {
  if (interaction.customId === 'tv_modal_rename') {
    const channel = interaction.channel;
    const newName = interaction.fields.getTextInputValue('new_name');

    renameCooldowns.set(channel.id, Date.now());
    await channel.setName(newName);

    return interaction.reply({ content: `✅ Oda ismi **"${newName}"** olarak güncellendi.`, ephemeral: true });
  }
}

// Bot Açılışında Boş Hayalet Odaları Temizle
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
  handleTempVoice,
  handleTempVoiceInteraction,
  handleTempVoiceModal,
  cleanupGhostTempRooms
};


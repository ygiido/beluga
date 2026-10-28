const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  RoleSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  ChannelType,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');
const { db, getSettings, updateSettings } = require('../../database/db');

function getMainDashboardEmbed(guild, settings) {
  const curseStatus = settings.anti_curse_enabled ? '🟢' : '🔴';
  const spamStatus = settings.anti_spam_enabled ? '🟢' : '🔴';
  const scamStatus = settings.anti_scam_enabled ? '🟢' : '🔴';
  const nukeStatus = settings.anti_nuke_enabled ? '🟢' : '🔴';
  const mediaStatus = settings.media_recovery_enabled ? '🟢' : '🔴';

  const jailRole = settings.jail_role_id ? `<@&${settings.jail_role_id}>` : '*Belirlenmedi*';
  const sicilRole = settings.sicilli_role_id ? `<@&${settings.sicilli_role_id}>` : '*Belirlenmedi*';
  const voiceChannel = settings.temp_voice_channel_id ? `<#${settings.temp_voice_channel_id}>` : '*Belirlenmedi*';

  return new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(`🧭 ${guild.name} — Kontrol & Yönetim Paneli`)
    .setDescription(
      `Sunucunuzun tüm bot sistemlerini ID kopyalamadan, aşağıdaki açılır menü ve butonlarla doğrudan yönetebilirsiniz.\n\n` +
      `**Canlı Modül Durumları:**\n` +
      `• Küfür Koruması: ${curseStatus} | Spam Koruması: ${spamStatus} | Scam Kalkanı: ${scamStatus}\n` +
      `• Anti-Nuke Koruması: ${nukeStatus} | CDN Medya Kurtarma: ${mediaStatus}\n\n` +
      `**Önemli Roller & Kanallar:**\n` +
      `• Ceza (Jail) Rolü: ${jailRole}\n` +
      `• Sicilli Rolü: ${sicilRole}\n` +
      `• Dinamik Ses Ana Odası: ${voiceChannel}`
    )
    .setFooter({ text: 'Beluga Dashboard • ID Ezberletmeyen Modern Deneyim' });
}

function getMainNavigationRow() {
  const menu = new StringSelectMenuBuilder()
    .setCustomId('panel_nav')
    .setPlaceholder('⚙️ Yapılandırmak istediğiniz modülü seçin...')
    .addOptions([
      { label: '🛡️ Moderasyon & Ceza Ayarları', value: 'nav_mod', description: 'Jail, Sicilli rolleri ve koruma kalkanları' },
      { label: '🎙️ Dinamik Geçici Ses Odaları', value: 'nav_voice', description: 'Oda oluşturma kanalı ve kategori seçimi' },
      { label: '🎫 Destek & Başvuru (Ticket)', value: 'nav_ticket', description: 'Destek paneli oluşturma ve departmanlar' },
      { label: '📜 6 Kategorili Log & Güvenlik', value: 'nav_log', description: 'Log kanalları eşleştirme ve Anti-Nuke' },
      { label: '⚡ Hızlı Şablon Kurulumu', value: 'nav_setup', description: 'Tek tıkla rolleri ve kanalları otomatik kur' }
    ]);

  return new ActionRowBuilder().addComponents(menu);
}

// 1. /panel Slash Komutu
const panelCommand = {
  data: new SlashCommandBuilder()
    .setName('panel')
    .setDescription('Tüm bot ayarlarını yönetebileceğiniz görsel kontrol panelini açar.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const settings = getSettings(interaction.guild.id);
    const embed = getMainDashboardEmbed(interaction.guild, settings);
    const navRow = getMainNavigationRow();

    await interaction.reply({
      embeds: [embed],
      components: [navRow],
      ephemeral: true
    });
  }
};

// 2. Panel Navigasyonu & Etkileşim Yöneticisi
async function handlePanelInteraction(interaction) {
  const guild = interaction.guild;
  const customId = interaction.customId;
  const settings = getSettings(guild.id);

  // A. Navigasyon Seçimi
  if (customId === 'panel_nav') {
    const choice = interaction.values[0];

    // MODERASYON AYARLARI
    if (choice === 'nav_mod') {
      const roleRow1 = new ActionRowBuilder().addComponents(
        new RoleSelectMenuBuilder().setCustomId('panel_set_jail_role').setPlaceholder('Jail (Ceza) Rolünü Seçin')
      );
      const roleRow2 = new ActionRowBuilder().addComponents(
        new RoleSelectMenuBuilder().setCustomId('panel_set_sicil_role').setPlaceholder('Sicilli Rolünü Seçin')
      );
      const toggleRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('panel_toggle_curse').setLabel(`Küfür Koruması: ${settings.anti_curse_enabled ? 'Açık' : 'Kapalı'}`).setStyle(settings.anti_curse_enabled ? ButtonStyle.Success : ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('panel_toggle_spam').setLabel(`Spam Koruması: ${settings.anti_spam_enabled ? 'Açık' : 'Kapalı'}`).setStyle(settings.anti_spam_enabled ? ButtonStyle.Success : ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('panel_toggle_scam').setLabel(`Scam Kalkanı: ${settings.anti_scam_enabled ? 'Açık' : 'Kapalı'}`).setStyle(settings.anti_scam_enabled ? ButtonStyle.Success : ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('panel_back').setLabel('◀️ Ana Menü').setStyle(ButtonStyle.Primary)
      );

      const modEmbed = new EmbedBuilder()
        .setColor(0xE67E22)
        .setTitle('🛡️ Moderasyon ve Güvenlik Ayarları')
        .setDescription('Rolleri aşağıdan doğrudan seçebilir ve koruma kalkanlarını açıp kapatabilirsiniz.');

      return interaction.update({ embeds: [modEmbed], components: [roleRow1, roleRow2, toggleRow] });
    }

    // SES ODALARI AYARLARI
    if (choice === 'nav_voice') {
      const channelRow = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId('panel_set_voice_trigger')
          .setPlaceholder('Tıklayınca Oda Açacak Ana Ses Kanalını Seçin')
          .setChannelTypes(ChannelType.GuildVoice)
      );
      const catRow = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId('panel_set_voice_cat')
          .setPlaceholder('Odaların Oluşacağı Ses Kategorisini Seçin')
          .setChannelTypes(ChannelType.GuildCategory)
      );
      const backRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('panel_back').setLabel('◀️ Ana Menü').setStyle(ButtonStyle.Primary)
      );

      const voiceEmbed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('🎙️ Dinamik Geçici Ses Odaları Ayarları')
        .setDescription('Kullanıcıların tıkladığı an kendi özel odalarını alacağı ana odayı ve kategoriyi seçin.');

      return interaction.update({ embeds: [voiceEmbed], components: [channelRow, catRow, backRow] });
    }

    // DESTEK (TICKET) AYARLARI
    if (choice === 'nav_ticket') {
      const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('panel_ticket_create_cat').setLabel('➕ Yeni Departman/Kategori Ekle').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('panel_ticket_send_embed').setLabel('📨 Paneli Kanala Gönder').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('panel_back').setLabel('◀️ Ana Menü').setStyle(ButtonStyle.Secondary)
      );

      const ticketEmbed = new EmbedBuilder()
        .setColor(0x2ECC71)
        .setTitle('🎫 Destek & Başvuru (Ticket) Yönetimi')
        .setDescription('Yeni bir bilet departmanı tanımlayabilir veya kullanıcıların tıklayıp bilet açacağı vitrin panelini kanala gönderebilirsiniz.');

      return interaction.update({ embeds: [ticketEmbed], components: [actionRow] });
    }

    // LOG VE GÜVENLİK AYARLARI
    if (choice === 'nav_log') {
      const logMenu = new StringSelectMenuBuilder()
        .setCustomId('panel_select_log_cat')
        .setPlaceholder('Kanalını atamak istediğiniz log türünü seçin...')
        .addOptions([
          { label: '💬 Mesaj & Ghost Ping Logu', value: 'log_message_channel_id' },
          { label: '📸 Medya Kurtarma (CDN) Logu', value: 'log_media_channel_id' },
          { label: '🎙️ Ses Mesai & Aktivite Logu', value: 'log_voice_channel_id' },
          { label: '⚖️ Moderasyon & Jail Logu', value: 'log_mod_channel_id' },
          { label: '🚨 Güvenlik & Anti-Nuke Logu', value: 'log_security_channel_id' },
          { label: '📥 Giriş & Sahte Davet Logu', value: 'log_join_channel_id' }
        ]);

      const toggleRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('panel_toggle_nuke').setLabel(`Anti-Nuke: ${settings.anti_nuke_enabled ? 'Açık' : 'Kapalı'}`).setStyle(settings.anti_nuke_enabled ? ButtonStyle.Success : ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('panel_toggle_media').setLabel(`Medya Kurtarma: ${settings.media_recovery_enabled ? 'Açık' : 'Kapalı'}`).setStyle(settings.media_recovery_enabled ? ButtonStyle.Success : ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('panel_back').setLabel('◀️ Ana Menü').setStyle(ButtonStyle.Primary)
      );

      const logEmbed = new EmbedBuilder()
        .setColor(0x9B59B6)
        .setTitle('📜 6 Kategorili Log & Güvenlik Ayarları')
        .setDescription('Aşağıdan atanacak log kategorisini seçip kanalını belirleyin.');

      return interaction.update({
        embeds: [logEmbed],
        components: [new ActionRowBuilder().addComponents(logMenu), toggleRow]
      });
    }

    // HIZLI ŞABLON KURULUMU
    if (choice === 'nav_setup') {
      const confirmRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('panel_confirm_setup').setLabel('⚡ Şablonu Kur (Otomatik Rol & Kanallar)').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('panel_back').setLabel('◀️ İptal / Geri').setStyle(ButtonStyle.Secondary)
      );

      const setupEmbed = new EmbedBuilder()
        .setColor(0xF1C40F)
        .setTitle('⚡ Hızlı Şablon Kurulumu')
        .setDescription(
          `Bu işlem sunucunuzda şu eksik yapıları otomatik kuracaktır:\n` +
          `• \`Jail\` ve \`Sicilli\` ceza rolleri\n` +
          `• \`Destek Yetkilisi\` rolü\n` +
          `• \`🔊 Oda Oluştur\` ana ses kanalı & kategorisi\n` +
          `• 6 adet hazır log kanalı\n\n` +
          `Devam etmek istiyor musunuz?`
        );

      return interaction.update({ embeds: [setupEmbed], components: [confirmRow] });
    }
  }

  // B. Geri Dönüş
  if (customId === 'panel_back') {
    const embed = getMainDashboardEmbed(guild, getSettings(guild.id));
    return interaction.update({ embeds: [embed], components: [getMainNavigationRow()] });
  }

  // C. Rol ve Kanal Seçim Yanıtları
  if (customId === 'panel_set_jail_role') {
    const roleId = interaction.values[0];
    updateSettings(guild.id, 'jail_role_id', roleId);
    return interaction.reply({ content: `✅ Jail rolü <@&${roleId}> olarak belirlendi.`, ephemeral: true });
  }

  if (customId === 'panel_set_sicil_role') {
    const roleId = interaction.values[0];
    updateSettings(guild.id, 'sicilli_role_id', roleId);
    return interaction.reply({ content: `✅ Sicilli rolü <@&${roleId}> olarak belirlendi.`, ephemeral: true });
  }

  if (customId === 'panel_set_voice_trigger') {
    const chId = interaction.values[0];
    updateSettings(guild.id, 'temp_voice_channel_id', chId);
    return interaction.reply({ content: `✅ Dinamik ses oluşturma kanalı <#${chId}> olarak belirlendi.`, ephemeral: true });
  }

  if (customId === 'panel_set_voice_cat') {
    const catId = interaction.values[0];
    updateSettings(guild.id, 'temp_voice_category_id', catId);
    return interaction.reply({ content: `✅ Dinamik ses odaları kategorisi belirlendi.`, ephemeral: true });
  }

  // D. Modül Aç/Kapa Butonları
  if (customId === 'panel_toggle_curse') {
    const newVal = settings.anti_curse_enabled ? 0 : 1;
    updateSettings(guild.id, 'anti_curse_enabled', newVal);
    return interaction.reply({ content: `Küfür Koruması: **${newVal ? '🟢 Açıldı' : '🔴 Kapatıldı'}**`, ephemeral: true });
  }

  if (customId === 'panel_toggle_spam') {
    const newVal = settings.anti_spam_enabled ? 0 : 1;
    updateSettings(guild.id, 'anti_spam_enabled', newVal);
    return interaction.reply({ content: `Spam Koruması: **${newVal ? '🟢 Açıldı' : '🔴 Kapatıldı'}**`, ephemeral: true });
  }

  if (customId === 'panel_toggle_scam') {
    const newVal = settings.anti_scam_enabled ? 0 : 1;
    updateSettings(guild.id, 'anti_scam_enabled', newVal);
    return interaction.reply({ content: `Scam Kalkanı: **${newVal ? '🟢 Açıldı' : '🔴 Kapatıldı'}**`, ephemeral: true });
  }

  if (customId === 'panel_toggle_nuke') {
    const newVal = settings.anti_nuke_enabled ? 0 : 1;
    updateSettings(guild.id, 'anti_nuke_enabled', newVal);
    return interaction.reply({ content: `Anti-Nuke: **${newVal ? '🟢 Açıldı' : '🔴 Kapatıldı'}**`, ephemeral: true });
  }

  if (customId === 'panel_toggle_media') {
    const newVal = settings.media_recovery_enabled ? 0 : 1;
    updateSettings(guild.id, 'media_recovery_enabled', newVal);
    return interaction.reply({ content: `CDN Medya Kurtarma: **${newVal ? '🟢 Açıldı' : '🔴 Kapatıldı'}**`, ephemeral: true });
  }

  // E. Log Kategorisi Kanal Eşleştirme
  if (customId === 'panel_select_log_cat') {
    const targetField = interaction.values[0];
    const chSelect = new ChannelSelectMenuBuilder()
      .setCustomId(`panel_set_log_${targetField}`)
      .setPlaceholder('Bağlanacak Log Kanalını Seçin')
      .setChannelTypes(ChannelType.GuildText);

    return interaction.reply({
      content: `📌 Lütfen seçtiğiniz log kategorisi için kanalı belirleyin:`,
      components: [new ActionRowBuilder().addComponents(chSelect)],
      ephemeral: true
    });
  }

  if (customId.startsWith('panel_set_log_')) {
    const field = customId.replace('panel_set_log_', '');
    const chId = interaction.values[0];
    updateSettings(guild.id, field, chId);
    return interaction.update({ content: `✅ Log kanalı <#${chId}> olarak başarıyla kaydedildi.`, components: [] });
  }

  // F. Bilet Kategori Ekleme Modal
  if (customId === 'panel_ticket_create_cat') {
    const modal = new ModalBuilder()
      .setCustomId('panel_modal_ticket_cat')
      .setTitle('Yeni Destek Kategorisi Tanımla');

    const nameInput = new TextInputBuilder()
      .setCustomId('cat_name')
      .setLabel('Departman / Kategori Adı')
      .setPlaceholder('Örn: Genel Destek, Şikayet, Başvuru')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(nameInput));
    return interaction.showModal(modal);
  }

  // G. Bilet Vitrin Mesajını Kanala Gönderme
  if (customId === 'panel_ticket_send_embed') {
    const chSelect = new ChannelSelectMenuBuilder()
      .setCustomId('panel_ticket_dispatch_channel')
      .setPlaceholder('Bilet Vitrin Paneli Hangi Kanala Gönderilsin?')
      .setChannelTypes(ChannelType.GuildText);

    return interaction.reply({
      content: 'Bilet oluşturma vitrinini göndereceğiniz kanalı seçin:',
      components: [new ActionRowBuilder().addComponents(chSelect)],
      ephemeral: true
    });
  }

  if (customId === 'panel_ticket_dispatch_channel') {
    const targetChId = interaction.values[0];
    const targetChannel = guild.channels.cache.get(targetChId);

    const categories = db.prepare('SELECT * FROM ticket_categories WHERE guild_id = ?').all(guild.id);
    if (categories.length === 0) {
      return interaction.update({
        content: '⚠️ Önce en az bir destek departmanı eklemelisiniz! (Panelden "Yeni Departman Ekle" butonunu kullanın)',
        components: []
      });
    }

    const ticketButtons = categories.map(cat =>
      new ButtonBuilder()
        .setCustomId(`ticket_open_${cat.id}`)
        .setLabel(cat.name)
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📩')
    );

    const row = new ActionRowBuilder().addComponents(ticketButtons.slice(0, 5));

    const showcaseEmbed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('🎫 Destek & Başvuru Merkezi')
      .setDescription('Aşağıdaki butonlara tıklayarak ilgili departmandan özel destek bileti oluşturabilirsiniz.\nYetkili ekibimiz en kısa sürede size yardımcı olacaktır.')
      .setFooter({ text: 'Beluga Destek Sistemi' });

    await targetChannel.send({ embeds: [showcaseEmbed], components: [row] });
    return interaction.update({ content: `✅ Destek vitrini <#${targetChId}> kanalına başarıyla gönderildi!`, components: [] });
  }

  // H. Şablon Kurulumunu Çalıştırma
  if (customId === 'panel_confirm_setup') {
    await interaction.deferUpdate();

    try {
      // 1. Rolleri oluştur
      const jailRole = await guild.roles.create({ name: 'Jail (Cezalı)', color: 0x2f3136, permissions: [] });
      const sicilRole = await guild.roles.create({ name: 'Sicilli', color: 0x8b0000, permissions: [] });
      const staffRole = await guild.roles.create({ name: 'Destek Yetkilisi', color: 0x00ae86, permissions: [] });

      // 2. Ses Kategorisi ve Odası
      const voiceCat = await guild.channels.create({ name: '🎙️ SES ODALARI', type: ChannelType.GuildCategory });
      const triggerVoice = await guild.channels.create({ name: '➕ Oda Oluştur', type: ChannelType.GuildVoice, parent: voiceCat.id });

      // 3. Log Kategorisi ve Kanalları
      const logCat = await guild.channels.create({
        name: '📜 DENETİM & LOG',
        type: ChannelType.GuildCategory,
        permissionOverwrites: [{ id: guild.id, deny: [PermissionFlagsBits.ViewChannel] }]
      });

      const chMsg = await guild.channels.create({ name: 'mesaj-log', type: ChannelType.GuildText, parent: logCat.id });
      const chMedia = await guild.channels.create({ name: 'medya-kurtarma', type: ChannelType.GuildText, parent: logCat.id });
      const chVoice = await guild.channels.create({ name: 'ses-mesai-log', type: ChannelType.GuildText, parent: logCat.id });
      const chMod = await guild.channels.create({ name: 'moderasyon-log', type: ChannelType.GuildText, parent: logCat.id });
      const chSec = await guild.channels.create({ name: 'guvenlik-alarm-log', type: ChannelType.GuildText, parent: logCat.id });
      const chJoin = await guild.channels.create({ name: 'giris-cikis-log', type: ChannelType.GuildText, parent: logCat.id });
      const chTicketArch = await guild.channels.create({ name: 'bilet-arsiv-log', type: ChannelType.GuildText, parent: logCat.id });

      // 4. Veritabanına kaydet
      db.prepare(`
        UPDATE guild_settings SET
          jail_role_id = ?,
          sicilli_role_id = ?,
          temp_voice_channel_id = ?,
          temp_voice_category_id = ?,
          log_message_channel_id = ?,
          log_media_channel_id = ?,
          log_voice_channel_id = ?,
          log_mod_channel_id = ?,
          log_security_channel_id = ?,
          log_join_channel_id = ?,
          log_ticket_archive_id = ?
        WHERE guild_id = ?
      `).run(
        jailRole.id, sicilRole.id, triggerVoice.id, voiceCat.id,
        chMsg.id, chMedia.id, chVoice.id, chMod.id, chSec.id, chJoin.id, chTicketArch.id,
        guild.id
      );

      // Varsayılan bir bilet departmanı ekle
      db.prepare('INSERT INTO ticket_categories (guild_id, name, staff_role_id) VALUES (?, ?, ?)')
        .run(guild.id, 'Genel Destek', staffRole.id);

      const successEmbed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('✅ Hızlı Şablon Kurulumu Tamamlandı!')
        .setDescription(
          `Sunucunuz için gerekli tüm yapılar hazırlandı ve sisteme bağlandı:\n\n` +
          `• **Roller:** ${jailRole}, ${sicilRole}, ${staffRole}\n` +
          `• **Dinamik Ses:** ${triggerVoice}\n` +
          `• **Log Kanalları:** 7 adet özel kanal kuruldu ve gizlendi.`
        );

      return interaction.editReply({ embeds: [successEmbed], components: [getMainNavigationRow()] });
    } catch (err) {
      console.error('Şablon kurulum hatası:', err);
      return interaction.editReply({ content: '❌ Şablon kurulurken yetki hatası oluştu. Botun "Yönetici" yetkisine sahip olduğundan emin olun.', components: [] });
    }
  }
}

// Modal Yanıtı (Bilet Kategorisi Ekleme)
async function handlePanelModal(interaction) {
  if (interaction.customId === 'panel_modal_ticket_cat') {
    const catName = interaction.fields.getTextInputValue('cat_name');
    db.prepare('INSERT INTO ticket_categories (guild_id, name) VALUES (?, ?)')
      .run(interaction.guild.id, catName);

    return interaction.reply({ content: `✅ **"${catName}"** isimli destek departmanı başarıyla eklendi!`, ephemeral: true });
  }
}

module.exports = {
  panelCommand,
  handlePanelInteraction,
  handlePanelModal
};


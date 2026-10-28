const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  RoleSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');
const {
  getLogChannels,
  updateLogChannel,
  getStreamSettings,
  updateStreamSettings,
  db
} = require('../database/db');

const LOG_CATEGORIES = {
  message_log: { name: '💬 Mesaj & Ghost Ping Logu', desc: 'Silinen ve düzenlenen mesajlar, hayalet etiketler' },
  media_log: { name: '📸 Medya Kurtarma (CDN) Logu', desc: 'Silinen görsel ve video kurtarma kanıtları' },
  voice_log: { name: '🎙️ Ses, Mikrofon & Kamera Logu', desc: 'Ses giriş/çıkış, mikrofon, kamera, yayın ve süreler' },
  member_log: { name: '👤 Üye Hareketleri Logu', desc: 'Giriş, çıkış, roller, timeout, ban ve sahte davetler' },
  server_log: { name: '🏛️ Sunucu & Rol/Kanal Logu', desc: 'Kanal ve rol oluşturma, silme ve düzenlemeleri' },
  security_log: { name: '🚨 Güvenlik & Kırmızı Alarmlar', desc: 'Kritik rol izinleri ve Anti-Nuke saldırı alarmları' }
};

// 1. Ana Dashboard Embed'i
function getGeneralSettingsEmbed(guild) {
  const currentLogs = getLogChannels(guild.id);
  const streamSettings = getStreamSettings(guild.id);
  const streamers = db.prepare('SELECT * FROM streamers WHERE guild_id = ?').all(guild.id);

  const formatCh = (id) => id ? `<#${id}>` : '`Ayarlanmadı ❌`';
  const formatRole = (role) => {
    if (!role) return '`Yok / Kapalı ❌`';
    if (role === 'everyone') return '`@everyone`';
    if (role === 'here') return '`@here`';
    return `<@&${role}>`;
  };

  const adStatus = currentLogs.anti_ad_enabled !== 0 ? '🟢 Aktif' : '🔴 Kapalı';
  const timeoutStatus = currentLogs.auto_timeout_enabled !== 0 ? '🟢 Aktif' : '🔴 Kapalı';

  return new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(`⚙️ ${guild.name} — Bot Yönetim & Ayar Paneli`)
    .setDescription(
      `Aşağıdaki menüden yapılandırmak istediğiniz sistemi seçebilirsiniz:\n\n` +
      `**🛡️ Koruma & Moderasyon Kalkanları:**\n` +
      `• 🚫 Uyarısız Reklam & Link Engeli: **${adStatus}** (3. Reklamda Kick)\n` +
      `• ⏳ Küfür, Spam & Flood Koruması: **${timeoutStatus}** (Katlanan 20dk Timeout)\n\n` +
      `**📜 Log Kanalları Durumu:**\n` +
      `• Mesaj: ${formatCh(currentLogs.message_log)} | Medya: ${formatCh(currentLogs.media_log)}\n` +
      `• Ses: ${formatCh(currentLogs.voice_log)} | Üye: ${formatCh(currentLogs.member_log)}\n` +
      `• Sunucu/Rol: ${formatCh(currentLogs.server_log)} | Güvenlik: ${formatCh(currentLogs.security_log)}\n\n` +
      `**🔴 Canlı Yayın Duyuru Sistemi:**\n` +
      `• Duyuru Kanalı: ${formatCh(streamSettings.announcement_channel_id)}\n` +
      `• Bildirim Rolü: ${formatRole(streamSettings.ping_role_id)}\n` +
      `• Takip Edilen Yayıncı Sayısı: **${streamers.length}** adet`
    )
    .setFooter({ text: 'Aşağıdaki menüyü kullanarak ayarlara erişebilirsiniz.' })
    .setTimestamp();
}

function getMainNavigationMenu() {
  const menu = new StringSelectMenuBuilder()
    .setCustomId('settings_nav')
    .setPlaceholder('⚙️ Yapılandırmak istediğiniz kategoriyi seçin...')
    .addOptions([
      { label: '🛡️ Koruma & Moderasyon Kalkanları', value: 'nav_security', description: 'Reklam/link engeli, küfür, spam ve katlanan timeout' },
      { label: '📜 Log & Denetim Kanalları Ayarları', value: 'nav_logs', description: 'Mesaj, ses, medya ve güvenlik log kanallarını bağla' },
      { label: '🔴 YouTube & Kick Canlı Yayın Duyuruları', value: 'nav_streamers', description: 'Yayıncı linkleri ekle, duyuru kanalını belirle' }
    ]);

  return new ActionRowBuilder().addComponents(menu);
}

// 2. Güvenlik & Moderasyon Kalkanları Ekranı
function getSecurityDashboardEmbed(guild) {
  const currentLogs = getLogChannels(guild.id);
  const adStatus = currentLogs.anti_ad_enabled !== 0;
  const timeoutStatus = currentLogs.auto_timeout_enabled !== 0;

  return new EmbedBuilder()
    .setColor(0xED4245)
    .setTitle('🛡️ Koruma & Moderasyon Kalkanları')
    .setDescription(
      `Sunucunuzun otomatik koruma mekanizmalarını aşağıdan tek tıkla açıp kapatabilirsiniz:\n\n` +
      `**1. 🚫 Uyarısız Reklam & Link Engeli:** ${adStatus ? '🟢 **AKTİF**' : '🔴 **KAPALI**'}\n` +
      `• Davet linkleri ve tüm harici web bağlantılarını uyarısız siler.\n` +
      `• **Ceza:** 1. Reklam 1 Saat, 2. Reklam 24 Saat Timeout ➔ **3. Reklamda Sunucudan Atma (Kick)**!\n\n` +
      `**2. ⏳ Küfür, Spam & Flood Koruması:** ${timeoutStatus ? '🟢 **AKTİF**' : '🔴 **KAPALI**'}\n` +
      `• Leetspeak bypasslı küfürleri, hızlı spam ve flood mesajları siler.\n` +
      `• **Ceza:** 20 dakikadan başlayan ve her tekrarda 2 katına katlanan (20dk ➔ 40dk ➔ 80dk...) Discord yerel zaman aşımı.`
    )
    .setFooter({ text: 'Butonlara basarak kalkanları anında açıp kapatabilirsiniz.' });
}

function getSecurityActionRow(guild) {
  const currentLogs = getLogChannels(guild.id);
  const adStatus = currentLogs.anti_ad_enabled !== 0;
  const timeoutStatus = currentLogs.auto_timeout_enabled !== 0;

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('settings_toggle_ad')
      .setLabel(`Reklam Engeli: ${adStatus ? 'AÇIK 🟢' : 'KAPALI 🔴'}`)
      .setStyle(adStatus ? ButtonStyle.Success : ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('settings_toggle_timeout')
      .setLabel(`Küfür/Spam: ${timeoutStatus ? 'AÇIK 🟢' : 'KAPALI 🔴'}`)
      .setStyle(timeoutStatus ? ButtonStyle.Success : ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('settings_back_main')
      .setLabel('◀️ Ana Menü')
      .setStyle(ButtonStyle.Secondary)
  );

  return [row];
}

// 3. Yayıncı Ayarları Menüsü
function getStreamersDashboardEmbed(guild) {
  const streamSettings = getStreamSettings(guild.id);
  const streamers = db.prepare('SELECT * FROM streamers WHERE guild_id = ?').all(guild.id);

  const formatCh = (id) => id ? `<#${id}>` : '`Belirlenmedi ❌`';
  const formatRole = (role) => {
    if (!role) return '`Yok ❌`';
    if (role === 'everyone') return '`@everyone`';
    if (role === 'here') return '`@here`';
    return `<@&${role}>`;
  };

  const streamerList = streamers.length > 0
    ? streamers.map((s, i) => `**${i + 1}. [${s.platform.toUpperCase()}]** [${s.channel_name}](${s.channel_url}) — ${s.is_live ? '🟢 **CANLI**' : '⚪ Çevrimdışı'}`).join('\n')
    : '*Henüz eklenmiş bir yayıncı yok.*';

  return new EmbedBuilder()
    .setColor(0xED4245)
    .setTitle('🔴 Canlı Yayın Duyuru Yönetimi')
    .setDescription(
      `YouTube ve Kick yayıncıları canlı yayına geçtiğinde anında butonlu embed duyurusu gönderilir.\n\n` +
      `• **Duyuru Kanalı:** ${formatCh(streamSettings.announcement_channel_id)}\n` +
      `• **Etiketlenecek Rol:** ${formatRole(streamSettings.ping_role_id)}\n\n` +
      `**Takip Edilen Yayıncılar:**\n${streamerList}`
    )
    .setFooter({ text: 'Aşağıdaki butonlarla kanal bağlayabilir veya yeni yayıncı ekleyebilirsiniz.' });
}

function getStreamerActionRows(guild) {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('stream_btn_set_channel').setLabel('📢 Duyuru Kanalı Seç').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('stream_btn_add_streamer').setLabel('➕ Yayıncı Ekle (Modal)').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('stream_btn_remove_streamer').setLabel('🗑️ Yayıncı Sil').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('stream_btn_set_role').setLabel('🔔 Bildirim Rolü').setStyle(ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('settings_back_main').setLabel('◀️ Ana Ayarlar Menüsü').setStyle(ButtonStyle.Secondary)
  );

  return [row1, row2];
}

const settingsCommand = {
  data: new SlashCommandBuilder()
    .setName('ayarlar')
    .setDescription('Tüm bot ayarlarını (kalkanlar, loglar, yayın duyuruları) yönetir.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const embed = getGeneralSettingsEmbed(interaction.guild);
    const navRow = getMainNavigationMenu();

    await interaction.reply({
      embeds: [embed],
      components: [navRow],
      ephemeral: true
    });
  }
};

async function handleSettingsInteraction(interaction) {
  const guild = interaction.guild;
  const customId = interaction.customId;

  // 1. Ana Navigasyon
  if (customId === 'settings_nav') {
    const choice = interaction.values[0];

    // MODERASYON & GÜVENLİK KALKANLARI
    if (choice === 'nav_security') {
      const secEmbed = getSecurityDashboardEmbed(guild);
      const rows = getSecurityActionRow(guild);

      return interaction.update({
        embeds: [secEmbed],
        components: rows
      });
    }

    // LOG AYARLARI
    if (choice === 'nav_logs') {
      const options = Object.entries(LOG_CATEGORIES).map(([key, info]) => ({
        label: info.name,
        value: key,
        description: info.desc
      }));

      const menu = new StringSelectMenuBuilder()
        .setCustomId('settings_select_log_cat')
        .setPlaceholder('⚙️ Kanalını belirlemek istediğiniz log türünü seçin...')
        .addOptions(options);

      const backRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('settings_back_main').setLabel('◀️ Ana Menü').setStyle(ButtonStyle.Secondary)
      );

      const logEmbed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('📜 Log Kanalları Yapılandırması')
        .setDescription('Aşağıdaki menüden bir kategori seçip mevcut metin kanalınızı eşleştirebilirsiniz.');

      return interaction.update({
        embeds: [logEmbed],
        components: [new ActionRowBuilder().addComponents(menu), backRow]
      });
    }

    // YAYINCI DUYURU AYARLARI
    if (choice === 'nav_streamers') {
      const streamEmbed = getStreamersDashboardEmbed(guild);
      const rows = getStreamerActionRows(guild);

      return interaction.update({
        embeds: [streamEmbed],
        components: rows
      });
    }
  }

  // 2. Ana Menüye Dönüş
  if (customId === 'settings_back_main') {
    const embed = getGeneralSettingsEmbed(guild);
    const navRow = getMainNavigationMenu();

    return interaction.update({
      embeds: [embed],
      components: [navRow]
    });
  }

  // 3. Güvenlik Buton Aç/Kapa Etkileşimleri
  if (customId === 'settings_toggle_ad') {
    const currentLogs = getLogChannels(guild.id);
    const newState = currentLogs.anti_ad_enabled !== 0 ? 0 : 1;
    updateLogChannel(guild.id, 'anti_ad_enabled', newState);

    const secEmbed = getSecurityDashboardEmbed(guild);
    const rows = getSecurityActionRow(guild);

    return interaction.update({
      embeds: [secEmbed],
      components: rows
    });
  }

  if (customId === 'settings_toggle_timeout') {
    const currentLogs = getLogChannels(guild.id);
    const newState = currentLogs.auto_timeout_enabled !== 0 ? 0 : 1;
    updateLogChannel(guild.id, 'auto_timeout_enabled', newState);

    const secEmbed = getSecurityDashboardEmbed(guild);
    const rows = getSecurityActionRow(guild);

    return interaction.update({
      embeds: [secEmbed],
      components: rows
    });
  }

  // 4. Log Kanalı Seçim Adımları
  if (customId === 'settings_select_log_cat') {
    const selectedCategory = interaction.values[0];
    const catInfo = LOG_CATEGORIES[selectedCategory];

    const chMenu = new ChannelSelectMenuBuilder()
      .setCustomId(`settings_bind_log_${selectedCategory}`)
      .setPlaceholder(`${catInfo.name} için bir kanal seçin...`)
      .setChannelTypes(ChannelType.GuildText);

    const btnRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`settings_unbind_log_${selectedCategory}`).setLabel('Kanalı Sıfırla (Kaldır)').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('settings_back_main').setLabel('◀️ Ana Menü').setStyle(ButtonStyle.Secondary)
    );

    const promptEmbed = new EmbedBuilder()
      .setColor(0xFEE75C)
      .setTitle(`📌 Kanal Seçimi: ${catInfo.name}`)
      .setDescription(`Bu kategori için logların iletileceği kanalı seçin:`);

    return interaction.update({
      embeds: [promptEmbed],
      components: [new ActionRowBuilder().addComponents(chMenu), btnRow]
    });
  }

  if (customId.startsWith('settings_bind_log_')) {
    const categoryKey = customId.replace('settings_bind_log_', '');
    const chosenChannelId = interaction.values[0];
    updateLogChannel(guild.id, categoryKey, chosenChannelId);

    const embed = getGeneralSettingsEmbed(guild);
    return interaction.update({ embeds: [embed], components: [getMainNavigationMenu()] });
  }

  if (customId.startsWith('settings_unbind_log_')) {
    const categoryKey = customId.replace('settings_unbind_log_', '');
    updateLogChannel(guild.id, categoryKey, null);

    const embed = getGeneralSettingsEmbed(guild);
    return interaction.update({ embeds: [embed], components: [getMainNavigationMenu()] });
  }

  // -------------------------------------------------------------
  // 5. CANLI YAYIN DUYURU ETKİLEŞİMLERİ
  // -------------------------------------------------------------
  if (customId === 'stream_btn_set_channel') {
    const chMenu = new ChannelSelectMenuBuilder()
      .setCustomId('stream_select_channel')
      .setPlaceholder('Canlı yayın duyurularının atılacağı kanalı seçin...')
      .setChannelTypes(ChannelType.GuildText);

    const row = new ActionRowBuilder().addComponents(chMenu);
    return interaction.reply({ content: '📢 Lütfen duyuru kanalını seçin:', components: [row], ephemeral: true });
  }

  if (customId === 'stream_select_channel') {
    const chId = interaction.values[0];
    updateStreamSettings(guild.id, 'announcement_channel_id', chId);
    return interaction.update({ content: `✅ Canlı yayın duyuru kanalı <#${chId}> olarak belirlendi!`, components: [] });
  }

  if (customId === 'stream_btn_add_streamer') {
    const modal = new ModalBuilder()
      .setCustomId('stream_modal_add')
      .setTitle('Yeni Yayıncı Ekle');

    const platformInput = new TextInputBuilder()
      .setCustomId('streamer_platform')
      .setLabel('Platform (kick veya youtube yazın)')
      .setPlaceholder('kick / youtube')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const nameInput = new TextInputBuilder()
      .setCustomId('streamer_name')
      .setLabel('Yayıncı / Kanal Adı')
      .setPlaceholder('Örn: Elraenn, Tolunay Ören')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const urlInput = new TextInputBuilder()
      .setCustomId('streamer_url')
      .setLabel('Kanal Linki veya Kullanıcı Adı')
      .setPlaceholder('https://kick.com/elraenn veya https://youtube.com/@tolunayoren')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(platformInput),
      new ActionRowBuilder().addComponents(nameInput),
      new ActionRowBuilder().addComponents(urlInput)
    );

    return interaction.showModal(modal);
  }

  if (customId === 'stream_btn_remove_streamer') {
    const streamers = db.prepare('SELECT * FROM streamers WHERE guild_id = ?').all(guild.id);
    if (streamers.length === 0) {
      return interaction.reply({ content: '⚠️ Sunucuda silinecek ekli bir yayıncı bulunmuyor.', ephemeral: true });
    }

    const select = new StringSelectMenuBuilder()
      .setCustomId('stream_select_delete')
      .setPlaceholder('Silmek istediğiniz yayıncıyı seçin...')
      .addOptions(streamers.map(s => ({
        label: `${s.channel_name} (${s.platform.toUpperCase()})`,
        value: `${s.id}`,
        description: s.channel_url.slice(0, 50)
      })));

    return interaction.reply({
      content: '🗑️ Listeden kaldırmak istediğiniz yayıncıyı seçin:',
      components: [new ActionRowBuilder().addComponents(select)],
      ephemeral: true
    });
  }

  if (customId === 'stream_select_delete') {
    const streamerId = interaction.values[0];
    db.prepare('DELETE FROM streamers WHERE id = ? AND guild_id = ?').run(streamerId, guild.id);
    return interaction.update({ content: '✅ Yayıncı başarıyla listeden kaldırıldı!', components: [] });
  }

  if (customId === 'stream_btn_set_role') {
    const roleMenu = new RoleSelectMenuBuilder()
      .setCustomId('stream_select_role')
      .setPlaceholder('Etiketlenecek rolü seçin...');

    const btnRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('stream_role_everyone').setLabel('@everyone Etiketle').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('stream_role_none').setLabel('Rol Etiketini Kaldır').setStyle(ButtonStyle.Secondary)
    );

    return interaction.reply({
      content: '🔔 Canlı yayın başladığında hangi rol etiketlensin?',
      components: [new ActionRowBuilder().addComponents(roleMenu), btnRow],
      ephemeral: true
    });
  }

  if (customId === 'stream_select_role') {
    const roleId = interaction.values[0];
    updateStreamSettings(guild.id, 'ping_role_id', roleId);
    return interaction.update({ content: `✅ Bildirim rolü <@&${roleId}> olarak ayarlandı.`, components: [] });
  }

  if (customId === 'stream_role_everyone') {
    updateStreamSettings(guild.id, 'ping_role_id', 'everyone');
    return interaction.update({ content: '✅ Bildirim rolü **@everyone** olarak ayarlandı.', components: [] });
  }

  if (customId === 'stream_role_none') {
    updateStreamSettings(guild.id, 'ping_role_id', null);
    return interaction.update({ content: '✅ Bildirim etiketlemesi kapatıldı.', components: [] });
  }
}

// Modal Form Gönderimi (Yayıncı Ekleme)
async function handleStreamModal(interaction) {
  if (interaction.customId !== 'stream_modal_add') return;

  const rawPlatform = interaction.fields.getTextInputValue('streamer_platform').trim().toLowerCase();
  const name = interaction.fields.getTextInputValue('streamer_name').trim();
  const url = interaction.fields.getTextInputValue('streamer_url').trim();

  const platform = rawPlatform.includes('kick') ? 'kick' : (rawPlatform.includes('you') ? 'youtube' : null);

  if (!platform) {
    return interaction.reply({ content: '❌ Geçersiz platform! Lütfen yalnızca `kick` veya `youtube` yazın.', ephemeral: true });
  }

  db.prepare(`
    INSERT INTO streamers (guild_id, platform, channel_name, channel_url, is_live)
    VALUES (?, ?, ?, ?, 0)
  `).run(interaction.guild.id, platform, name, url);

  return interaction.reply({
    content: `✅ **${name}** ([${platform.toUpperCase()}](${url})) başarıyla takip listesine eklendi!\nCanlı yayına geçtiğinde otomatik duyuru gönderilecektir.`,
    ephemeral: true
  });
}

module.exports = {
  settingsCommand,
  handleSettingsInteraction,
  handleStreamModal
};

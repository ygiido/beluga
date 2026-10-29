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
  message_log: { name: '💬 Mesaj & Ghost Ping', desc: 'Silinen/düzenlenen mesajlar' },
  media_log: { name: '📸 Medya Kurtarma', desc: 'Silinen fotoğraf ve videolar' },
  voice_log: { name: '🎙️ Ses & Mesai', desc: 'Ses, mikrofon, kamera hareketleri' },
  member_log: { name: '👤 Üye Hareketleri', desc: 'Giriş, çıkış, roller ve timeout' },
  server_log: { name: '🏛️ Sunucu & Rol/Kanal', desc: 'Kanal ve rol değişiklikleri' },
  security_log: { name: '🚨 Güvenlik Alarmları', desc: 'Anti-nuke ve kritik izinler' }
};

// 1. Ana Dashboard (Sade ve Minimalist)
function getGeneralSettingsEmbed(guild) {
  const currentLogs = getLogChannels(guild.id);
  const streamSettings = getStreamSettings(guild.id);
  const streamers = db.prepare('SELECT * FROM streamers WHERE guild_id = ?').all(guild.id);
  const mediaOnly = db.prepare('SELECT * FROM media_only_channels WHERE guild_id = ?').all(guild.id);

  const formatCh = (id) => id ? `<#${id}>` : '`Ayarlanmadı`';
  const adStatus = currentLogs.anti_ad_enabled !== 0 ? '🟢 Açık' : '🔴 Kapalı';
  const timeoutStatus = currentLogs.auto_timeout_enabled !== 0 ? '🟢 Açık' : '🔴 Kapalı';

  const logKeys = ['message_log', 'media_log', 'voice_log', 'member_log', 'server_log', 'security_log'];
  const activeLogCount = logKeys.filter(k => currentLogs[k]).length;

  return new EmbedBuilder()
    .setColor(0x2B2D31)
    .setTitle(`⚙️ ${guild.name} — Bot Paneli`)
    .setDescription(
      `**🛡️ Korumalar**\n` +
      `• Reklam Engeli: ${adStatus} *(3. de atar)*\n` +
      `• Küfür/Spam: ${timeoutStatus} *(Katlanan timeout)*\n\n` +
      `**🎙️ Geçici Ses & Medya**\n` +
      `• Dinamik Ses Tetikleyici: ${formatCh(currentLogs.temp_voice_channel_id)}\n` +
      `• Sadece Medya Kanalları: **${mediaOnly.length}** adet aktif\n\n` +
      `**📜 Sistem Durumu**\n` +
      `• Loglar: **${activeLogCount}/6** bağlı | Yayıncılar: **${streamers.length}** takipte`
    )
    .setFooter({ text: 'Aşağıdaki menüden yapılandırmak istediğiniz ayarı seçin.' });
}

function getMainNavigationMenu() {
  const menu = new StringSelectMenuBuilder()
    .setCustomId('settings_nav')
    .setPlaceholder('⚙️ Bir ayar kategorisi seçin...')
    .addOptions([
      { label: '🛡️ Güvenlik & Korumalar', value: 'nav_security', description: 'Reklam engeli ve küfür/spam koruması' },
      { label: '🎙️ Geçici Ses Odaları (Temp Voice)', value: 'nav_tempvoice', description: 'Oda açma kanalı ve kategori seçimi' },
      { label: '📸 Sadece-Medya Kanalları', value: 'nav_mediaonly', description: 'Yalnızca fotoğraf/video atılabilen kanallar' },
      { label: '📜 Log Kanalları', value: 'nav_logs', description: 'Mesaj, ses, medya ve üye log kanalları' },
      { label: '🔴 Canlı Yayın Duyuruları', value: 'nav_streamers', description: 'Kick ve YouTube yayın bildirimleri' }
    ]);

  return new ActionRowBuilder().addComponents(menu);
}

// 2. Güvenlik Kalkanları Ekranı
function getSecurityDashboardEmbed(guild) {
  const currentLogs = getLogChannels(guild.id);
  const adStatus = currentLogs.anti_ad_enabled !== 0;
  const timeoutStatus = currentLogs.auto_timeout_enabled !== 0;

  return new EmbedBuilder()
    .setColor(0x2B2D31)
    .setTitle('🛡️ Güvenlik ve Korumalar')
    .setDescription(
      `Butonlara tıklayarak korumaları anında açıp kapatabilirsiniz.\n\n` +
      `• **Reklam & Link:** ${adStatus ? '🟢 Açık' : '🔴 Kapalı'}\n` +
      `  *1. ve 2. ihlalde timeout, 3. ihlalde sunucudan atar.*\n\n` +
      `• **Küfür, Spam & Flood:** ${timeoutStatus ? '🟢 Açık' : '🔴 Kapalı'}\n` +
      `  *20 dakikadan başlayan ve her tekrarda katlanan timeout.*`
    );
}

function getSecurityActionRow(guild) {
  const currentLogs = getLogChannels(guild.id);
  const adStatus = currentLogs.anti_ad_enabled !== 0;
  const timeoutStatus = currentLogs.auto_timeout_enabled !== 0;

  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('settings_toggle_ad').setLabel(`Reklam: ${adStatus ? 'Açık 🟢' : 'Kapalı 🔴'}`).setStyle(adStatus ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('settings_toggle_timeout').setLabel(`Küfür/Spam: ${timeoutStatus ? 'Açık 🟢' : 'Kapalı 🔴'}`).setStyle(timeoutStatus ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('settings_back_main').setLabel('◀️ Geri').setStyle(ButtonStyle.Primary)
  )];
}

// 3. Geçici Ses Odaları Ekranı
function getTempVoiceDashboardEmbed(guild) {
  const current = getLogChannels(guild.id);
  const trigger = current.temp_voice_channel_id ? `<#${current.temp_voice_channel_id}>` : '`Ayarlanmadı`';
  const category = current.temp_voice_category_id ? `<#${current.temp_voice_category_id}>` : '`Ayarlanmadı`';

  return new EmbedBuilder()
    .setColor(0x2B2D31)
    .setTitle('🎙️ Geçici Ses Odaları Ayarları')
    .setDescription(
      `Kullanıcılar "Oda Oluştur" kanalına girdiğinde anında kendilerine özel oda açılır ve taşınırlar.\n\n` +
      `• **Oda Oluşturma Tetikleyici Kanalı:** ${trigger}\n` +
      `• **Odaların Açılacağı Kategori:** ${category}\n\n` +
      `*Açılan odanın dahili metin sohbetine hem butonlu hem menülü kontrol paneli otomatik gönderilir.*`
    );
}

// 4. Sadece-Medya Kanalları Ekranı
function getMediaOnlyDashboardEmbed(guild) {
  const channels = db.prepare('SELECT channel_id FROM media_only_channels WHERE guild_id = ?').all(guild.id);
  const list = channels.length > 0
    ? channels.map((c, i) => `${i + 1}. <#${c.channel_id}>`).join('\n')
    : '*Henüz eklenmiş bir kanal yok.*';

  return new EmbedBuilder()
    .setColor(0x2B2D31)
    .setTitle('📸 Sadece-Medya Kanalları')
    .setDescription(
      `Bu kanallara gönderilen mesajlarda **fotoğraf, video veya medya linki yoksa** bot mesajı anında siler.\n\n` +
      `**Mevcut Kanallar:**\n${list}`
    );
}

// 5. Log Kanalları Ekranı
function getLogsDashboardEmbed(guild) {
  const current = getLogChannels(guild.id);
  const formatCh = (id) => id ? `<#${id}>` : '`Yok`';

  return new EmbedBuilder()
    .setColor(0x2B2D31)
    .setTitle('📜 Log Kanalları')
    .setDescription(
      `• 💬 **Mesaj:** ${formatCh(current.message_log)}\n` +
      `• 📸 **Medya (CDN):** ${formatCh(current.media_log)}\n` +
      `• 🎙️ **Ses:** ${formatCh(current.voice_log)}\n` +
      `• 👤 **Üye:** ${formatCh(current.member_log)}\n` +
      `• 🏛️ **Sunucu/Rol:** ${formatCh(current.server_log)}\n` +
      `• 🚨 **Güvenlik:** ${formatCh(current.security_log)}`
    );
}

// 6. Yayıncı Duyuru Ekranı
function getStreamersDashboardEmbed(guild) {
  const streamSettings = getStreamSettings(guild.id);
  const streamers = db.prepare('SELECT * FROM streamers WHERE guild_id = ?').all(guild.id);

  const formatCh = (id) => id ? `<#${id}>` : '`Ayarlanmadı`';
  const formatRole = (role) => {
    if (!role) return '`Kapalı`';
    if (role === 'everyone') return '`@everyone`';
    if (role === 'here') return '`@here`';
    return `<@&${role}>`;
  };

  const streamerList = streamers.length > 0
    ? streamers.map((s, i) => `${i + 1}. **[${s.platform.toUpperCase()}]** [${s.channel_name}](${s.channel_url}) ${s.is_live ? '🔴' : '⚪'}`).join('\n')
    : '*Ekli yayıncı bulunmuyor.*';

  return new EmbedBuilder()
    .setColor(0x2B2D31)
    .setTitle('🔴 Canlı Yayın Duyuruları')
    .setDescription(
      `• **Duyuru Kanalı:** ${formatCh(streamSettings.announcement_channel_id)}\n` +
      `• **Bildirim Rolü:** ${formatRole(streamSettings.ping_role_id)}\n\n` +
      `**Takip Listesi:**\n${streamerList}`
    );
}

const settingsCommand = {
  data: new SlashCommandBuilder()
    .setName('ayarlar')
    .setDescription('Tüm bot ayarlarını yönetir.')
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

    if (choice === 'nav_security') {
      return interaction.update({ embeds: [getSecurityDashboardEmbed(guild)], components: getSecurityActionRow(guild) });
    }

    if (choice === 'nav_tempvoice') {
      const channelRow = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId('settings_tv_set_trigger')
          .setPlaceholder('➕ Oda Oluşturma Ses Kanalını Seçin...')
          .setChannelTypes(ChannelType.GuildVoice)
      );
      const catRow = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId('settings_tv_set_category')
          .setPlaceholder('📁 Odaların Açılacağı Kategoriyi Seçin...')
          .setChannelTypes(ChannelType.GuildCategory)
      );
      const backRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('settings_back_main').setLabel('◀️ Geri').setStyle(ButtonStyle.Secondary)
      );

      return interaction.update({
        embeds: [getTempVoiceDashboardEmbed(guild)],
        components: [channelRow, catRow, backRow]
      });
    }

    if (choice === 'nav_mediaonly') {
      const chMenu = new ChannelSelectMenuBuilder()
        .setCustomId('settings_mediaonly_toggle')
        .setPlaceholder('Sadece-Medya listesine kanal ekle/çıkar...')
        .setChannelTypes(ChannelType.GuildText);

      const backRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('settings_back_main').setLabel('◀️ Geri').setStyle(ButtonStyle.Secondary)
      );

      return interaction.update({
        embeds: [getMediaOnlyDashboardEmbed(guild)],
        components: [new ActionRowBuilder().addComponents(chMenu), backRow]
      });
    }

    if (choice === 'nav_logs') {
      const options = Object.entries(LOG_CATEGORIES).map(([key, info]) => ({
        label: info.name,
        value: key,
        description: info.desc
      }));

      const menu = new StringSelectMenuBuilder()
        .setCustomId('settings_select_log_cat')
        .setPlaceholder('Kanalını atamak istediğiniz kategoriyi seçin...')
        .addOptions(options);

      const backRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('settings_back_main').setLabel('◀️ Geri').setStyle(ButtonStyle.Secondary)
      );

      return interaction.update({
        embeds: [getLogsDashboardEmbed(guild)],
        components: [new ActionRowBuilder().addComponents(menu), backRow]
      });
    }

    if (choice === 'nav_streamers') {
      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('stream_btn_set_channel').setLabel('📢 Kanal Seç').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('stream_btn_add_streamer').setLabel('➕ Yayıncı Ekle').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('stream_btn_remove_streamer').setLabel('🗑️ Yayıncı Sil').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('stream_btn_set_role').setLabel('🔔 Rol Seç').setStyle(ButtonStyle.Secondary)
      );
      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('settings_back_main').setLabel('◀️ Geri').setStyle(ButtonStyle.Secondary)
      );

      return interaction.update({
        embeds: [getStreamersDashboardEmbed(guild)],
        components: [row1, row2]
      });
    }
  }

  // 2. Ana Menüye Dönüş
  if (customId === 'settings_back_main') {
    return interaction.update({ embeds: [getGeneralSettingsEmbed(guild)], components: [getMainNavigationMenu()] });
  }

  // 3. Güvenlik Butonları
  if (customId === 'settings_toggle_ad') {
    const current = getLogChannels(guild.id);
    updateLogChannel(guild.id, 'anti_ad_enabled', current.anti_ad_enabled !== 0 ? 0 : 1);
    return interaction.update({ embeds: [getSecurityDashboardEmbed(guild)], components: getSecurityActionRow(guild) });
  }

  if (customId === 'settings_toggle_timeout') {
    const current = getLogChannels(guild.id);
    updateLogChannel(guild.id, 'auto_timeout_enabled', current.auto_timeout_enabled !== 0 ? 0 : 1);
    return interaction.update({ embeds: [getSecurityDashboardEmbed(guild)], components: getSecurityActionRow(guild) });
  }

  // 4. Temp Voice Ayarları
  if (customId === 'settings_tv_set_trigger') {
    const chId = interaction.values[0];
    updateLogChannel(guild.id, 'temp_voice_channel_id', chId);
    return interaction.reply({ content: `✅ Oda oluşturma tetikleyici kanalı <#${chId}> olarak ayarlandı.`, ephemeral: true });
  }

  if (customId === 'settings_tv_set_category') {
    const catId = interaction.values[0];
    updateLogChannel(guild.id, 'temp_voice_category_id', catId);
    return interaction.reply({ content: `✅ Dinamik odaların açılacağı kategori belirlendi.`, ephemeral: true });
  }

  // 5. Sadece-Medya Kanal Ekleme/Çıkarma
  if (customId === 'settings_mediaonly_toggle') {
    const chId = interaction.values[0];
    const exists = db.prepare('SELECT 1 FROM media_only_channels WHERE guild_id = ? AND channel_id = ?').get(guild.id, chId);

    if (exists) {
      db.prepare('DELETE FROM media_only_channels WHERE guild_id = ? AND channel_id = ?').run(guild.id, chId);
      return interaction.reply({ content: `❌ <#${chId}> Sadece-Medya listesinden çıkarıldı.`, ephemeral: true });
    } else {
      db.prepare('INSERT INTO media_only_channels (guild_id, channel_id) VALUES (?, ?)').run(guild.id, chId);
      return interaction.reply({ content: `✅ <#${chId}> kanalı Sadece-Medya olarak ayarlandı. (Metin mesajları silinecektir)`, ephemeral: true });
    }
  }

  // 6. Log Kanalı Seçim Adımları
  if (customId === 'settings_select_log_cat') {
    const selectedCategory = interaction.values[0];
    const catInfo = LOG_CATEGORIES[selectedCategory];

    const chMenu = new ChannelSelectMenuBuilder()
      .setCustomId(`settings_bind_log_${selectedCategory}`)
      .setPlaceholder(`${catInfo.name} için kanal seçin...`)
      .setChannelTypes(ChannelType.GuildText);

    const btnRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`settings_unbind_log_${selectedCategory}`).setLabel('Kanalı Sıfırla').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('settings_back_main').setLabel('◀️ Geri').setStyle(ButtonStyle.Secondary)
    );

    const promptEmbed = new EmbedBuilder()
      .setColor(0x2B2D31)
      .setTitle(`📌 Kanal Seçimi: ${catInfo.name}`)
      .setDescription(`Bu kategori için logların aktarılacağı metin kanalını seçin:`);

    return interaction.update({ embeds: [promptEmbed], components: [new ActionRowBuilder().addComponents(chMenu), btnRow] });
  }

  if (customId.startsWith('settings_bind_log_')) {
    const categoryKey = customId.replace('settings_bind_log_', '');
    updateLogChannel(guild.id, categoryKey, interaction.values[0]);
    return interaction.update({ embeds: [getGeneralSettingsEmbed(guild)], components: [getMainNavigationMenu()] });
  }

  if (customId.startsWith('settings_unbind_log_')) {
    const categoryKey = customId.replace('settings_unbind_log_', '');
    updateLogChannel(guild.id, categoryKey, null);
    return interaction.update({ embeds: [getGeneralSettingsEmbed(guild)], components: [getMainNavigationMenu()] });
  }

  // 7. Canlı Yayın Duyuru Etkileşimleri
  if (customId === 'stream_btn_set_channel') {
    const chMenu = new ChannelSelectMenuBuilder().setCustomId('stream_select_channel').setPlaceholder('Duyuruların atılacağı kanalı seçin...').setChannelTypes(ChannelType.GuildText);
    return interaction.reply({ content: '📢 Lütfen duyuru kanalını seçin:', components: [new ActionRowBuilder().addComponents(chMenu)], ephemeral: true });
  }

  if (customId === 'stream_select_channel') {
    updateStreamSettings(guild.id, 'announcement_channel_id', interaction.values[0]);
    return interaction.update({ content: `✅ Canlı yayın duyuru kanalı <#${interaction.values[0]}> olarak belirlendi.`, components: [] });
  }

  if (customId === 'stream_btn_add_streamer') {
    const modal = new ModalBuilder().setCustomId('stream_modal_add').setTitle('Yayıncı Ekle');
    const pIn = new TextInputBuilder().setCustomId('streamer_platform').setLabel('Platform (kick veya youtube)').setPlaceholder('kick / youtube').setStyle(TextInputStyle.Short).setRequired(true);
    const nIn = new TextInputBuilder().setCustomId('streamer_name').setLabel('Yayıncı Adı').setPlaceholder('Örn: Elraenn, Tolunay Ören').setStyle(TextInputStyle.Short).setRequired(true);
    const uIn = new TextInputBuilder().setCustomId('streamer_url').setLabel('Kanal Linki veya Kullanıcı Adı').setPlaceholder('https://kick.com/elraenn veya @tolunayoren').setStyle(TextInputStyle.Short).setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(pIn), new ActionRowBuilder().addComponents(nIn), new ActionRowBuilder().addComponents(uIn));
    return interaction.showModal(modal);
  }

  if (customId === 'stream_btn_remove_streamer') {
    const streamers = db.prepare('SELECT * FROM streamers WHERE guild_id = ?').all(guild.id);
    if (streamers.length === 0) return interaction.reply({ content: '⚠️ Ekli bir yayıncı bulunmuyor.', ephemeral: true });

    const select = new StringSelectMenuBuilder().setCustomId('stream_select_delete').setPlaceholder('Silmek istediğiniz yayıncıyı seçin...').addOptions(streamers.map(s => ({
      label: `${s.channel_name} (${s.platform.toUpperCase()})`, value: `${s.id}`, description: s.channel_url.slice(0, 50)
    })));

    return interaction.reply({ content: '🗑️ Silinecek yayıncıyı seçin:', components: [new ActionRowBuilder().addComponents(select)], ephemeral: true });
  }

  if (customId === 'stream_select_delete') {
    db.prepare('DELETE FROM streamers WHERE id = ? AND guild_id = ?').run(interaction.values[0], guild.id);
    return interaction.update({ content: '✅ Yayıncı listeden kaldırıldı.', components: [] });
  }

  if (customId === 'stream_btn_set_role') {
    const roleMenu = new RoleSelectMenuBuilder().setCustomId('stream_select_role').setPlaceholder('Etiketlenecek rolü seçin...');
    const btnRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('stream_role_everyone').setLabel('@everyone').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('stream_role_none').setLabel('Kapat').setStyle(ButtonStyle.Secondary)
    );

    return interaction.reply({ content: '🔔 Canlı yayın başladığında hangi rol etiketlensin?', components: [new ActionRowBuilder().addComponents(roleMenu), btnRow], ephemeral: true });
  }

  if (customId === 'stream_select_role') {
    updateStreamSettings(guild.id, 'ping_role_id', interaction.values[0]);
    return interaction.update({ content: `✅ Bildirim rolü <@&${interaction.values[0]}> olarak ayarlandı.`, components: [] });
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

// Modal Form Gönderimi
async function handleStreamModal(interaction) {
  if (interaction.customId !== 'stream_modal_add') return;

  const rawPlatform = interaction.fields.getTextInputValue('streamer_platform').trim().toLowerCase();
  const name = interaction.fields.getTextInputValue('streamer_name').trim();
  const url = interaction.fields.getTextInputValue('streamer_url').trim();

  const platform = rawPlatform.includes('kick') ? 'kick' : (rawPlatform.includes('you') ? 'youtube' : null);
  if (!platform) return interaction.reply({ content: '❌ Geçersiz platform! Yalnızca `kick` veya `youtube` yazın.', ephemeral: true });

  db.prepare(`
    INSERT INTO streamers (guild_id, platform, channel_name, channel_url, is_live)
    VALUES (?, ?, ?, ?, 0)
  `).run(interaction.guild.id, platform, name, url);

  return interaction.reply({ content: `✅ **${name}** (${platform.toUpperCase()}) listeye eklendi!`, ephemeral: true });
}

module.exports = {
  settingsCommand,
  handleSettingsInteraction,
  handleStreamModal
};

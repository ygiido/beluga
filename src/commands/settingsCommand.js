const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder
} = require('discord.js');
const { getLogChannels, updateLogChannel } = require('../database/db');

const LOG_CATEGORIES = {
  message_log: { name: '💬 Mesaj & Ghost Ping Logu', desc: 'Silinen ve düzenlenen mesajlar, hayalet etiketler' },
  media_log: { name: '📸 Medya Kurtarma (CDN) Logu', desc: 'Silinen görsel ve video kurtarma kanıtları' },
  voice_log: { name: '🎙️ Ses, Mikrofon & Kamera Logu', desc: 'Ses giriş/çıkış, mikrofon, kamera, yayın ve süreler' },
  member_log: { name: '👤 Üye Hareketleri Logu', desc: 'Giriş, çıkış, roller, timeout, ban ve sahte davetler' },
  server_log: { name: '🏛️ Sunucu & Rol/Kanal Logu', desc: 'Kanal ve rol oluşturma, silme ve düzenlemeleri' },
  security_log: { name: '🚨 Güvenlik & Kırmızı Alarmlar', desc: 'Kritik rol izinleri ve Anti-Nuke saldırı alarmları' }
};

function getSettingsEmbed(guild) {
  const current = getLogChannels(guild.id);

  const formatCh = (id) => id ? `<#${id}>` : '`Ayarlanmadı ❌`';

  return new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(`⚙️ ${guild.name} — Log ve Denetim Ayarları`)
    .setDescription(
      `Aşağıdaki menüyü kullanarak sunucunuzdaki mevcut kanalları log kategorilerine doğrudan bağlayabilirsiniz.\n\n` +
      `**Mevcut Kanal Eşleştirmeleri:**\n` +
      `• 💬 **Mesaj & Ghost Ping:** ${formatCh(current.message_log)}\n` +
      `• 📸 **Medya Kurtarma (CDN):** ${formatCh(current.media_log)}\n` +
      `• 🎙️ **Ses, Mikrofon & Kamera:** ${formatCh(current.voice_log)}\n` +
      `• 👤 **Üye Hareketleri:** ${formatCh(current.member_log)}\n` +
      `• 🏛️ **Sunucu & Rol/Kanal:** ${formatCh(current.server_log)}\n` +
      `• 🚨 **Güvenlik & Kırmızı Alarm:** ${formatCh(current.security_log)}\n`
    )
    .setFooter({ text: 'Aşağıdaki menüden ayarlamak istediğiniz kategoriyi seçin.' })
    .setTimestamp();
}

function getMainCategoryMenu() {
  const options = Object.entries(LOG_CATEGORIES).map(([key, info]) => ({
    label: info.name,
    value: key,
    description: info.desc
  }));

  const menu = new StringSelectMenuBuilder()
    .setCustomId('settings_select_category')
    .setPlaceholder('⚙️ Kanalını belirlemek istediğiniz log türünü seçin...')
    .addOptions(options);

  return new ActionRowBuilder().addComponents(menu);
}

const settingsCommand = {
  data: new SlashCommandBuilder()
    .setName('ayarlar')
    .setDescription('Sunucunun log kanalı eşleştirmelerini menüden yönetmenizi sağlar.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const embed = getSettingsEmbed(interaction.guild);
    const menuRow = getMainCategoryMenu();

    await interaction.reply({
      embeds: [embed],
      components: [menuRow],
      ephemeral: true
    });
  }
};

async function handleSettingsInteraction(interaction) {
  const guild = interaction.guild;
  const customId = interaction.customId;

  // 1. Kategori Seçildi ➔ Kanal Seçici Menüsünü Getir
  if (customId === 'settings_select_category') {
    const selectedCategory = interaction.values[0];
    const catInfo = LOG_CATEGORIES[selectedCategory];

    const chMenu = new ChannelSelectMenuBuilder()
      .setCustomId(`settings_bind_${selectedCategory}`)
      .setPlaceholder(`${catInfo.name} için bir kanal seçin...`)
      .setChannelTypes(ChannelType.GuildText);

    const btnRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`settings_unbind_${selectedCategory}`)
        .setLabel('Kanalı Sıfırla (Kaldır)')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('settings_back_main')
        .setLabel('◀️ Ana Menü')
        .setStyle(ButtonStyle.Secondary)
    );

    const promptEmbed = new EmbedBuilder()
      .setColor(0xFEE75C)
      .setTitle(`📌 Kanal Seçimi: ${catInfo.name}`)
      .setDescription(
        `**${catInfo.name}** bildirimlerinin aktarılmasını istediğiniz mevcut metin kanalını aşağıdaki açılır menüden seçin.\n\n` +
        `*İpucu: Eğer bu kategori için log kaydı tutulmasını istemiyorsanız "Kanalı Sıfırla" butonuna basabilirsiniz.*`
      );

    return interaction.update({
      embeds: [promptEmbed],
      components: [new ActionRowBuilder().addComponents(chMenu), btnRow]
    });
  }

  // 2. Kanal Seçildi ➔ DB Güncelle ve Ana Paneli Yenile
  if (customId.startsWith('settings_bind_')) {
    const categoryKey = customId.replace('settings_bind_', '');
    const chosenChannelId = interaction.values[0];

    updateLogChannel(guild.id, categoryKey, chosenChannelId);

    const updatedEmbed = getSettingsEmbed(guild);
    const mainRow = getMainCategoryMenu();

    return interaction.update({
      embeds: [updatedEmbed],
      components: [mainRow]
    });
  }

  // 3. Kanalı Sıfırla (Kaldır) ➔ DB'den Temizle
  if (customId.startsWith('settings_unbind_')) {
    const categoryKey = customId.replace('settings_unbind_', '');

    updateLogChannel(guild.id, categoryKey, null);

    const updatedEmbed = getSettingsEmbed(guild);
    const mainRow = getMainCategoryMenu();

    return interaction.update({
      embeds: [updatedEmbed],
      components: [mainRow]
    });
  }

  // 4. Ana Menüye Dönüş
  if (customId === 'settings_back_main') {
    const embed = getSettingsEmbed(guild);
    const mainRow = getMainCategoryMenu();

    return interaction.update({
      embeds: [embed],
      components: [mainRow]
    });
  }
}

module.exports = {
  settingsCommand,
  handleSettingsInteraction
};

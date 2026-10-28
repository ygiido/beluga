const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder
} = require('discord.js');
const { updateLogChannel } = require('../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('log-ayarla')
    .setDescription('Belirli bir log türü için mevcut bir kanalı atar.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option.setName('tur')
        .setDescription('Atanacak log kategorisi')
        .setRequired(true)
        .addChoices(
          { name: '💬 Mesaj & Ghost Ping Logu', value: 'message_log' },
          { name: '📸 Medya Kurtarma (CDN) Logu', value: 'media_log' },
          { name: '🎙️ Ses, Mikrofon & Kamera Logu', value: 'voice_log' },
          { name: '👤 Üye, Rol & Timeout Logu', value: 'member_log' },
          { name: '🏛️ Sunucu, Kanal & Rol Logu', value: 'server_log' },
          { name: '🚨 Güvenlik & Alarm Logu', value: 'security_log' }
        )
    )
    .addChannelOption(option =>
      option.setName('kanal')
        .setDescription('Logların gönderileceği metin kanalı')
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText)
    ),

  async execute(interaction) {
    const logType = interaction.options.getString('tur');
    const channel = interaction.options.getChannel('kanal');

    updateLogChannel(interaction.guild.id, logType, channel.id);

    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setDescription(`✅ **${logType}** kategorisi başarıyla <#${channel.id}> kanalına bağlandı!`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};

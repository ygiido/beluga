const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder
} = require('discord.js');
const { updateLogChannel } = require('../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('log-kur')
    .setDescription('Tüm detaylı denetim ve güvenlik log kanallarını otomatik kurar.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const guild = interaction.guild;

    try {
      // 1. Log Kategorisi Oluştur (@everyone'a gizli, yalnızca yöneticilere açık)
      const category = await guild.channels.create({
        name: '📜 SUNUCU DENETİM LOGLARI',
        type: ChannelType.GuildCategory,
        permissionOverwrites: [
          {
            id: guild.id, // @everyone
            deny: [PermissionFlagsBits.ViewChannel]
          }
        ]
      });

      // 2. 6 Temel Log Kanalını Kur
      const chMessage = await guild.channels.create({ name: '💬・mesaj-log', type: ChannelType.GuildText, parent: category.id });
      const chMedia = await guild.channels.create({ name: '📸・medya-kurtarma', type: ChannelType.GuildText, parent: category.id });
      const chVoice = await guild.channels.create({ name: '🎙️・ses-log', type: ChannelType.GuildText, parent: category.id });
      const chMember = await guild.channels.create({ name: '👤・üye-log', type: ChannelType.GuildText, parent: category.id });
      const chServer = await guild.channels.create({ name: '🏛️・sunucu-kanal-rol-log', type: ChannelType.GuildText, parent: category.id });
      const chSecurity = await guild.channels.create({ name: '🚨・güvenlik-alarm-log', type: ChannelType.GuildText, parent: category.id });

      // 3. Veritabanına Kaydet
      updateLogChannel(guild.id, 'message_log', chMessage.id);
      updateLogChannel(guild.id, 'media_log', chMedia.id);
      updateLogChannel(guild.id, 'voice_log', chVoice.id);
      updateLogChannel(guild.id, 'member_log', chMember.id);
      updateLogChannel(guild.id, 'server_log', chServer.id);
      updateLogChannel(guild.id, 'security_log', chSecurity.id);

      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('✅ Detaylı Denetim Log Sistemi Kuruldu!')
        .setDescription(
          `Sunucunuzdaki her hareketi milisaniyesine kadar takip edecek 6 özel log kanalı kuruldu:\n\n` +
          `• **Mesaj & Ghost Ping:** ${chMessage}\n` +
          `• **Medya Kurtarma (CDN):** ${chMedia}\n` +
          `• **Ses, Mikrofon & Kamera:** ${chVoice}\n` +
          `• **Üye, Rol & Timeout:** ${chMember}\n` +
          `• **Kanal & Rol Hareketleri:** ${chServer}\n` +
          `• **Güvenlik & Kırmızı Alarm:** ${chSecurity}\n\n` +
          `*Kanallar @everyone rolüne gizlenmiştir, yalnızca yöneticiler görebilir.*`
        )
        .setFooter({ text: 'Beluga Ultra Audit Logger' })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('Log kurulum hatası:', err);
      return interaction.editReply({ content: '❌ Log kanalları oluşturulurken bir hata oluştu. Botun "Yönetici" yetkisine sahip olduğundan emin olun.' });
    }
  }
};

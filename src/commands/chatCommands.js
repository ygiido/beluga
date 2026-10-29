const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder
} = require('discord.js');
const { db } = require('../database/db');

// 1. /temizle Komutu
const temizleCommand = {
  data: new SlashCommandBuilder()
    .setName('temizle')
    .setDescription('Kanalda belirtilen miktarda mesajı siler.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption(opt =>
      opt.setName('miktar')
        .setDescription('Silinecek mesaj sayısı (1-100)')
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true)
    )
    .addUserOption(opt =>
      opt.setName('kullanici')
        .setDescription('Yalnızca bu üyenin mesajlarını sil (opsiyonel)')
        .setRequired(false)
    ),

  async execute(interaction) {
    const amount = interaction.options.getInteger('miktar');
    const targetUser = interaction.options.getUser('kullanici');
    const channel = interaction.channel;

    await interaction.deferReply({ ephemeral: true });

    try {
      let messagesToDelete;

      if (targetUser) {
        const fetched = await channel.messages.fetch({ limit: 100 });
        const userMessages = fetched.filter(m => m.author.id === targetUser.id);
        messagesToDelete = Array.from(userMessages.values()).slice(0, amount);
      } else {
        messagesToDelete = await channel.messages.fetch({ limit: amount });
      }

      const deleted = await channel.bulkDelete(messagesToDelete, true);

      return interaction.editReply({
        content: `🧹 ${targetUser ? `<@${targetUser.id}> kullanıcısına ait ` : ''}**${deleted.size}** adet mesaj başarıyla temizlendi.`
      });
    } catch (err) {
      console.error('Mesaj silme hatası:', err);
      return interaction.editReply({
        content: '❌ Mesajlar silinirken bir hata oluştu. 14 günden eski mesajlar Discord tarafından toplu silinemez.'
      });
    }
  }
};

// 2. /kilit Komutu
const kilitCommand = {
  data: new SlashCommandBuilder()
    .setName('kilit')
    .setDescription('Kanalı mesaj gönderimine kapatır veya açar.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addStringOption(opt =>
      opt.setName('durum')
        .setDescription('Kilit durumu')
        .setRequired(true)
        .addChoices(
          { name: '🔒 Kilitle (Kapat)', value: 'lock' },
          { name: '🔓 Kilidi Aç', value: 'unlock' }
        )
    ),

  async execute(interaction) {
    const action = interaction.options.getString('durum');
    const channel = interaction.channel;
    const isLock = action === 'lock';

    try {
      await channel.permissionOverwrites.edit(interaction.guild.id, {
        SendMessages: isLock ? false : null
      });

      const embed = new EmbedBuilder()
        .setColor(isLock ? 0xED4245 : 0x57F287)
        .setDescription(
          isLock
            ? `🔒 **Bu kanal yetkili tarafından mesaj gönderimine kapatıldı.**`
            : `🔓 **Bu kanal mesaj gönderimine tekrar açıldı.**`
        )
        .setFooter({ text: `İşlemi Yapan: ${interaction.user.tag}` })
        .setTimestamp();

      await channel.send({ embeds: [embed] });
      return interaction.reply({
        content: `✅ Kanal başarıyla **${isLock ? 'kilitlendi' : 'açıldı'}**.`,
        ephemeral: true
      });
    } catch (err) {
      console.error('Kanal kilit hatası:', err);
      return interaction.reply({
        content: '❌ Kanal izinleri güncellenirken bir yetki hatası oluştu.',
        ephemeral: true
      });
    }
  }
};

// 3. /yavas-mod Komutu
const yavasModCommand = {
  data: new SlashCommandBuilder()
    .setName('yavas-mod')
    .setDescription('Kanalın yavaş mod hızını ayarlar.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addIntegerOption(opt =>
      opt.setName('saniye')
        .setDescription('Mesajlar arası bekleme süresi saniye cinsinden (0 = Kapalı)')
        .setMinValue(0)
        .setMaxValue(21600)
        .setRequired(true)
    ),

  async execute(interaction) {
    const seconds = interaction.options.getInteger('saniye');
    const channel = interaction.channel;

    try {
      await channel.setRateLimitPerUser(seconds);

      return interaction.reply({
        content: seconds === 0
          ? '⏱️ Bu kanalda yavaş mod **kapatıldı**.'
          : `⏱️ Bu kanal için yavaş mod **${seconds} saniye** olarak ayarlandı.`,
        ephemeral: true
      });
    } catch (err) {
      console.error('Yavaş mod hatası:', err);
      return interaction.reply({
        content: '❌ Yavaş mod süresi güncellenirken bir hata oluştu.',
        ephemeral: true
      });
    }
  }
};

// 4. /af Komutu
const afCommand = {
  data: new SlashCommandBuilder()
    .setName('af')
    .setDescription('Bir üyenin cezasını kaldırır ve katlanan ceza sayaçlarını sıfırlar.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(opt =>
      opt.setName('kullanici')
        .setDescription('Affedilecek üye')
        .setRequired(true)
    ),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('kullanici');
    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    if (!member) {
      return interaction.reply({ content: '❌ Kullanıcı sunucuda bulunamadı.', ephemeral: true });
    }

    try {
      // 1. Varsa aktif timeout cezasını kaldır
      if (member.isCommunicationDisabled()) {
        await member.timeout(null, `Yetkili (${interaction.user.tag}) tarafından affedildi.`);
      }

      // 2. Veritabanındaki katlanan ceza sayaçlarını sıfırla
      db.prepare('DELETE FROM user_violations WHERE guild_id = ? AND user_id = ?').run(interaction.guild.id, targetUser.id);
      db.prepare('DELETE FROM user_ad_violations WHERE guild_id = ? AND user_id = ?').run(interaction.guild.id, targetUser.id);

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('🕊️ Üye Affedildi')
        .setDescription(
          `<@${targetUser.id}> (**${targetUser.tag}**) affedildi!\n\n` +
          `• Varsa aktif zaman aşımı cezası kaldırıldı.\n` +
          `• Küfür/spam ve reklam katlanan ihlal sayaçları tamamen sıfırlandı.`
        )
        .setFooter({ text: `Yetkili: ${interaction.user.tag}` })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    } catch (err) {
      console.error('Af hatası:', err);
      return interaction.reply({
        content: '❌ Ceza kaldırılırken bir hata oluştu. Botun rol hiyerarşisinin yeterli olduğundan emin olun.',
        ephemeral: true
      });
    }
  }
};

module.exports = {
  temizleCommand,
  kilitCommand,
  yavasModCommand,
  afCommand
};

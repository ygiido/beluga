const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db, getSettings } = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sicil')
    .setDescription('Bir üyenin ceza geçmişini ve sicil puanını görüntüler.')
    .addUserOption(option =>
      option.setName('kullanici')
        .setDescription('Sicili incelenecek üye (boş bırakılırsa kendiniz)')
        .setRequired(false)
    ),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('kullanici') || interaction.user;
    const guildId = interaction.guild.id;
    const settings = getSettings(guildId);

    const history = db.prepare('SELECT * FROM infractions WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 10')
      .all(guildId, targetUser.id);

    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total_count,
        SUM(points) as total_points,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_count
      FROM infractions
      WHERE guild_id = ? AND user_id = ?
    `).get(guildId, targetUser.id);

    const totalCount = stats.total_count || 0;
    const totalPoints = stats.total_points || 0;
    const activeCount = stats.active_count || 0;

    const embed = new EmbedBuilder()
      .setColor(activeCount > 0 ? 0xFF0000 : 0x00AE86)
      .setTitle(`📜 Sicil Dosyası: ${targetUser.tag}`)
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: '⚖️ Toplam İhlal', value: `\`${totalCount}\` adet`, inline: true },
        { name: '🔥 Sicil Puanı', value: `\`${totalPoints}\` puan`, inline: true },
        { name: '⛓️ Aktif Ceza', value: activeCount > 0 ? `\`${activeCount}\` (Hala Geçerli)` : '`Temiz`', inline: true }
      );

    if (history.length === 0) {
      embed.setDescription('✅ Bu üyenin kayıtlı herhangi bir ceza veya ihlal kaydı bulunmamaktadır.');
    } else {
      const records = history.map((inf, i) => {
        const date = new Date(inf.created_at).toLocaleDateString('tr-TR');
        const status = inf.is_active ? '🔴 Aktif' : '⚪ Tamamlandı';
        return `**${i + 1}. [${inf.type.toUpperCase()}]** - ${inf.reason} (${date}) | ${status}`;
      }).join('\n');

      embed.setDescription(`**Son İhlaller:**\n${records}`);
    }

    embed.setFooter({ text: 'Beluga Sicil Takip Sistemi' }).setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};


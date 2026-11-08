const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Botun gecikme (ping) süresini ve çalışma durumunu ölçer.'),

  async execute(interaction, client) {
    const sent = await interaction.reply({
      content: '🏓 Ölçülüyor...',
      fetchReply: true,
      ephemeral: true
    });

    const roundtripLatency = sent.createdTimestamp - interaction.createdTimestamp;
    const websocketPing = client.ws.ping;

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('🏓 Pong!')
      .addFields(
        { name: 'Gecikme (Roundtrip)', value: `\`${roundtripLatency}ms\``, inline: true },
        { name: 'WebSocket API', value: `\`${websocketPing}ms\``, inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ content: null, embeds: [embed] });
  }
};

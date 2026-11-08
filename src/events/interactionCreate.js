const { Events } = require('discord.js');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction, client) {
    // 1. Slash Komutları
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) {
        console.error(`Komut bulunamadı: ${interaction.commandName}`);
        return;
      }

      try {
        await command.execute(interaction, client);
      } catch (error) {
        console.error(`[Komut Hatası] /${interaction.commandName}:`, error);
        const replyPayload = {
          content: '❌ Bu komut çalıştırılırken bir hata oluştu.',
          ephemeral: true
        };

        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(replyPayload).catch(() => null);
        } else {
          await interaction.reply(replyPayload).catch(() => null);
        }
      }
      return;
    }

    // 2. Buton veya Seçim Menüleri (İleride eklenecek buton/menü handler'ları)
    if (interaction.isButton() || interaction.isAnySelectMenu() || interaction.isModalSubmit()) {
      // Modüler bileşen dinleyicisi için hazır
    }
  }
};

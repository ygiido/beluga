const { Events, ActivityType } = require('discord.js');
const { registerCommands } = require('../handlers/commandHandler');

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    console.log(`🤖 ${client.user.tag} başarıyla çevrimiçi oldu!`);
    console.log(`🌐 Bulunulan Sunucu Sayısı: ${client.guilds.cache.size}`);

    // Bot durumu (Presence)
    client.user.setPresence({
      activities: [{ name: 'Sunucu Güvenliği & Denetim', type: ActivityType.Watching }],
      status: 'online'
    });

    // Slash komutlarını sunuculara anında kaydet
    await registerCommands(client, client.slashCommandsArray || []);
  }
};

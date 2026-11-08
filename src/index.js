require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  Collection
} = require('discord.js');

const { loadEvents } = require('./handlers/eventHandler');
const { loadCommands } = require('./handlers/commandHandler');

// İstemci (Client) Tanımlama
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildEmojisAndStickers
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction,
    Partials.GuildMember,
    Partials.User
  ]
});

// Koleksiyonlar
client.commands = new Collection();

// Olayları ve Komutları Yükle
loadEvents(client);
client.slashCommandsArray = loadCommands(client);

// Hata Yakalayıcılar (Botun çökmesini önler)
process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ [Hata Yakalandı - unhandledRejection]:', reason);
});

process.on('uncaughtException', (err, origin) => {
  console.error('💥 [Kritik Hata - uncaughtException]:', err);
});

// Botu Başlat
if (process.env.DISCORD_TOKEN) {
  client.login(process.env.DISCORD_TOKEN).catch(err => {
    console.error('❌ Bot giriş hatası:', err.message);
  });
} else {
  console.error('⚠️ DISCORD_TOKEN tanımlanmadı. Lütfen .env dosyasını kontrol edin.');
}

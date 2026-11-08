const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');

function loadCommands(client) {
  const commandsPath = path.join(__dirname, '../commands');
  if (!fs.existsSync(commandsPath)) return [];

  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
  const commandsArray = [];

  for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));
    if (!command.data || !command.execute) continue;

    client.commands.set(command.data.name, command);
    commandsArray.push(command.data.toJSON());
  }

  console.log(`⚡ [Commands] ${client.commands.size} adet slash komut yüklendi.`);
  return commandsArray;
}

async function registerCommands(client, commandsArray) {
  const rest = new REST().setToken(process.env.DISCORD_TOKEN);

  try {
    // 1. Eski global çift komutları temizle
    await rest.put(Routes.applicationCommands(client.user.id), { body: [] });

    // 2. Anında görünmesi için mevcut sunuculara yükle
    for (const [_, guild] of client.guilds.cache) {
      await rest.put(
        Routes.applicationGuildCommands(client.user.id, guild.id),
        { body: commandsArray }
      );
      console.log(`✅ [Slash] ${commandsArray.length} komut [${guild.name}] sunucusuna yüklendi.`);
    }
  } catch (error) {
    console.error('❌ [Slash] Komut kayıt hatası:', error.message);
  }
}

module.exports = { loadCommands, registerCommands };

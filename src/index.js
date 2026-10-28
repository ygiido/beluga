require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  Events,
  AuditLogEvent
} = require('discord.js');

const { db } = require('./database/db');
const {
  handleVoiceState,
  handleMessageDelete,
  handleMessageUpdate,
  handleMessageDeleteBulk,
  handleMemberJoin,
  handleMemberLeave,
  handleMemberUpdate,
  handleGuildBanAdd,
  handleGuildBanRemove,
  handleChannelCreate,
  handleChannelDelete,
  handleRoleCreate,
  handleRoleDelete,
  handleRoleUpdate,
  checkAntiNuke
} = require('./modules/logger/loggerManager');

const { initStreamNotificationScheduler } = require('./modules/stream/streamChecker');
const {
  settingsCommand,
  handleSettingsInteraction,
  handleStreamModal
} = require('./commands/settingsCommand');

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
  partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.GuildMember, Partials.User]
});

const slashCommands = [settingsCommand.data];

// Slash Komutlarını Belirli Bir Sunucuya Kaydetme Fonksiyonu
async function deployCommandsToGuild(rest, clientId, guild) {
  try {
    await rest.put(
      Routes.applicationGuildCommands(clientId, guild.id),
      { body: slashCommands.map(cmd => cmd.toJSON()) }
    );
    console.log(`⚡ [${guild.name}] sunucusuna /ayarlar komutu kaydedildi.`);
  } catch (err) {
    console.error(`❌ [${guild.name}] komut yükleme hatası:`, err.message);
  }
}

// Bot Hazır Olduğunda
client.once(Events.ClientReady, async (c) => {
  console.log(`🤖 Beluga Ultra Logger & Stream Alerts Aktif: ${c.user.tag}`);
  console.log(`📊 Botun bulunduğu sunucu sayısı: ${c.guilds.cache.size}`);

  const rest = new REST().setToken(process.env.DISCORD_TOKEN);

  // 1. ÇİFT GÖZÜKMEYİ ENGELLEMEK İÇİN: Global komut listesini tamamen temizle
  try {
    await rest.put(
      Routes.applicationCommands(c.user.id),
      { body: [] }
    );
    console.log('🧹 Eski global komutlar temizlendi (çift görünme engellendi).');
  } catch (err) {
    console.error('Global temizleme hatası:', err.message);
  }

  // 2. Yalnızca sunucu düzeyinde (Guild-Level) kaydet
  for (const [_, guild] of c.guilds.cache) {
    await deployCommandsToGuild(rest, c.user.id, guild);
  }

  // Canlı Yayın Takip Döngüsünü Başlat
  initStreamNotificationScheduler(c);

  // Mevcut davetleri önbelleğe al
  for (const [_, guild] of c.guilds.cache) {
    try {
      const invites = await guild.invites.fetch();
      for (const [code, inv] of invites) {
        db.prepare('INSERT OR REPLACE INTO guild_invites (guild_id, code, inviter_id, uses) VALUES (?, ?, ?, ?)')
          .run(guild.id, code, inv.inviter?.id || null, inv.uses);
      }
    } catch (e) {}
  }
});

// Bot Yeni Bir Sunucuya Eklendiğinde Komutları Yükle
client.on(Events.GuildCreate, async (guild) => {
  const rest = new REST().setToken(process.env.DISCORD_TOKEN);
  await deployCommandsToGuild(rest, client.user.id, guild);
});

// 1. SES LOGLARI (Mikrofon, Kulaklık, Kamera, Yayın, Giriş/Çıkış, Mesai)
client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  await handleVoiceState(oldState, newState);
});

// 2. MESAJ LOGLARI (Silme, Düzenleme, CDN Medya Kurtarma, Ghost Ping)
client.on(Events.MessageDelete, async (message) => {
  await handleMessageDelete(message);
});

client.on(Events.MessageUpdate, async (oldMsg, newMsg) => {
  await handleMessageUpdate(oldMsg, newMsg);
});

client.on(Events.MessageBulkDelete, async (messages, channel) => {
  await handleMessageDeleteBulk(messages, channel);
});

// 3. ÜYE HAREKETLERİ (Giriş, Çıkış, İsim, Rol, Timeout, Ban)
client.on(Events.GuildMemberAdd, async (member) => {
  await handleMemberJoin(member);
});

client.on(Events.GuildMemberRemove, async (member) => {
  await handleMemberLeave(member);
});

client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
  await handleMemberUpdate(oldMember, newMember);
});

client.on(Events.GuildBanAdd, async (ban) => {
  await handleGuildBanAdd(ban);
});

client.on(Events.GuildBanRemove, async (ban) => {
  await handleGuildBanRemove(ban);
});

// 4. KANAL, ROL & GÜVENLİK
client.on(Events.ChannelCreate, async (channel) => {
  await handleChannelCreate(channel);
});

client.on(Events.ChannelDelete, async (channel) => {
  await handleChannelDelete(channel);
  if (channel.guild) await checkAntiNuke(channel.guild, AuditLogEvent.ChannelDelete);
});

client.on(Events.RoleCreate, async (role) => {
  await handleRoleCreate(role);
});

client.on(Events.RoleDelete, async (role) => {
  await handleRoleDelete(role);
  if (role.guild) await checkAntiNuke(role.guild, AuditLogEvent.RoleDelete);
});

client.on(Events.RoleUpdate, async (oldRole, newRole) => {
  await handleRoleUpdate(oldRole, newRole);
});

// 5. ETKİLEŞİMLER (Slash Komutları, Butonlar, Menüler, Modallar)
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'ayarlar') {
        return await settingsCommand.execute(interaction);
      }
    }

    if (interaction.isModalSubmit()) {
      if (interaction.customId === 'stream_modal_add') {
        return await handleStreamModal(interaction);
      }
    }

    if (interaction.customId?.startsWith('settings_') || interaction.customId?.startsWith('stream_')) {
      return await handleSettingsInteraction(interaction);
    }
  } catch (err) {
    console.error('Etkileşim hatası:', err);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '❌ İşlem sırasında bir hata oluştu.', ephemeral: true }).catch(() => null);
    }
  }
});

// Botu Başlat
if (process.env.DISCORD_TOKEN) {
  client.login(process.env.DISCORD_TOKEN).catch(err => {
    console.error('Bot giriş hatası:', err.message);
  });
} else {
  console.log('⚠️ DISCORD_TOKEN tanımlanmadı. Lütfen .env dosyasını doldurun.');
}

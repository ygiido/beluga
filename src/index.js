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

const { settingsCommand, handleSettingsInteraction } = require('./commands/settingsCommand');

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

// Bot Hazır Olduğunda
client.once(Events.ClientReady, async (c) => {
  console.log(`🤖 Beluga Ultra Logger Aktif: ${c.user.tag}`);

  // Slash Komutlarını Kaydet (/ayarlar)
  try {
    const rest = new REST().setToken(process.env.DISCORD_TOKEN);
    console.log('⚡ Slash komutları kaydediliyor...');
    await rest.put(
      Routes.applicationCommands(c.user.id),
      { body: slashCommands.map(cmd => cmd.toJSON()) }
    );
    console.log('✅ /ayarlar komutu başarıyla kaydedildi.');
  } catch (err) {
    console.error('Slash komut kayıt hatası:', err);
  }

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

// 5. ETKİLEŞİMLER (Slash Komutları & Menü Seçimleri)
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'ayarlar') {
        return await settingsCommand.execute(interaction);
      }
    }

    if (interaction.customId?.startsWith('settings_')) {
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

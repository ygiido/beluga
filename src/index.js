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
const { handleMessageModeration, initReleaseScheduler } = require('./modules/moderation/moderationEngine');
const { sicilCommand } = require('./modules/moderation/sicilCommand');
const {
  handleVoiceStateUpdate,
  handleTempVoiceInteraction,
  handleTempVoiceModal,
  cleanupGhostTempRooms
} = require('./modules/tempvoice/tempVoiceManager');
const {
  handleTicketButton,
  handleTicketModal,
  handleTicketMemberSelect,
  handleTicketFeedback,
  handleMemberLeaveTicketCheck
} = require('./modules/ticket/ticketManager');
const {
  handleMessageDelete,
  handleMessageUpdate,
  handleVoiceAudit,
  handleRoleUpdate,
  checkAntiNuke,
  handleMemberJoin,
  handleMemberLeave
} = require('./modules/logger/loggerManager');
const {
  panelCommand,
  handlePanelInteraction,
  handlePanelModal
} = require('./modules/panel/panelManager');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildModeration
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

const commands = [
  panelCommand.data,
  require('./modules/moderation/sicilCommand').data
];

// Bot Hazır Olduğunda
client.once(Events.ClientReady, async (c) => {
  console.log(`🤖 Beluga Bot aktif: ${c.user.tag}`);

  // Slash Komutlarını Kaydet
  try {
    const rest = new REST().setToken(process.env.DISCORD_TOKEN);
    console.log('⚡ Slash komutları kaydediliyor...');
    await rest.put(
      Routes.applicationCommands(c.user.id),
      { body: commands.map(cmd => cmd.toJSON()) }
    );
    console.log('✅ Slash komutları başarıyla kaydedildi.');
  } catch (err) {
    console.error('Slash komut kayıt hatası:', err);
  }

  // Hayalet Odaları Temizle
  await cleanupGhostTempRooms(c);

  // Otomatik Ceza Tahliye Zamanlayıcısını Başlat
  initReleaseScheduler(c);

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

// Mesaj Denetimi (Küfür, Spam, Scam)
client.on(Events.MessageCreate, async (message) => {
  await handleMessageModeration(message);
});

// Silinen Mesaj & CDN Medya Kurtarma & Ghost Ping
client.on(Events.MessageDelete, async (message) => {
  await handleMessageDelete(message);
});

// Düzenlenen Mesaj Logu
client.on(Events.MessageUpdate, async (oldMsg, newMsg) => {
  await handleMessageUpdate(oldMsg, newMsg);
});

// Dinamik Ses & Ses Mesai Denetimi
client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  await handleVoiceStateUpdate(oldState, newState);
  await handleVoiceAudit(oldState, newState);
});

// Yeni Üye Girişi (<15 gün şüpheli hesap + davetçi takibi)
client.on(Events.GuildMemberAdd, async (member) => {
  await handleMemberJoin(member);
});

// Üye Ayrılışı (Sahte davet düşme + askıda kalan bileti kapatma)
client.on(Events.GuildMemberRemove, async (member) => {
  await handleMemberLeave(member);
  await handleMemberLeaveTicketCheck(member);
});

// Kritik Rol Yetkisi Kırmızı Alarmı
client.on(Events.GuildRoleUpdate, async (oldRole, newRole) => {
  await handleRoleUpdate(oldRole, newRole);
});

// Anti-Nuke (Seri Kanal & Rol Silme Koruması)
client.on(Events.ChannelDelete, async (channel) => {
  if (channel.guild) await checkAntiNuke(channel.guild, AuditLogEvent.ChannelDelete);
});

client.on(Events.GuildRoleDelete, async (role) => {
  if (role.guild) await checkAntiNuke(role.guild, AuditLogEvent.RoleDelete);
});

// Etkileşimler (Slash Komutları, Butonlar, Menüler, Modallar)
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    // 1. Slash Komutları
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'panel') {
        return await panelCommand.execute(interaction);
      }
      if (interaction.commandName === 'sicil') {
        const sicilCmd = require('./modules/moderation/sicilCommand');
        return await sicilCmd.execute(interaction);
      }
    }

    // 2. Panel Etkileşimleri
    if (interaction.customId?.startsWith('panel_')) {
      return await handlePanelInteraction(interaction);
    }

    // 3. Dinamik Ses Odası Etkileşimleri
    if (interaction.customId?.startsWith('tv_')) {
      if (interaction.isModalSubmit()) {
        return await handleTempVoiceModal(interaction);
      }
      return await handleTempVoiceInteraction(interaction);
    }

    // 4. Destek (Ticket) Etkileşimleri
    if (interaction.customId?.startsWith('ticket_')) {
      if (interaction.isModalSubmit()) {
        return await handleTicketModal(interaction);
      }
      if (interaction.isUserSelectMenu()) {
        return await handleTicketMemberSelect(interaction);
      }
      return await handleTicketButton(interaction);
    }

    // 5. Destek Memnuniyet Puanlaması
    if (interaction.customId?.startsWith('feedback_')) {
      return await handleTicketFeedback(interaction);
    }

    // 6. Panel Modal Gönderimleri
    if (interaction.isModalSubmit()) {
      if (interaction.customId === 'panel_modal_ticket_cat') {
        return await handlePanelModal(interaction);
      }
    }
  } catch (err) {
    console.error('Etkileşim işlenirken hata oluştu:', err);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '❌ İşlem gerçekleştirilirken bir hata oluştu.', ephemeral: true }).catch(() => null);
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


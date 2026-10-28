const {
  ChannelType,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
  EmbedBuilder,
  AttachmentBuilder
} = require('discord.js');
const { db, getSettings } = require('../../database/db');

// Bilet içi Yetkili Paneli Bileşenleri
function getTicketControlRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_claim').setLabel('Talebi Üstlen (Claim)').setEmoji('🙋‍♂️').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('ticket_lock').setLabel('Kilitle / Aç').setEmoji('🔒').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('ticket_manage_member').setLabel('Üye Ekle/Çıkar').setEmoji('👥').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('ticket_close').setLabel('Kapat ve Arşivle').setEmoji('💾').setStyle(ButtonStyle.Danger)
  );
}

// 1. Modal Açma (Bilet Aç Butonuna Tıklanınca)
async function handleTicketButton(interaction) {
  const customId = interaction.customId;

  if (customId.startsWith('ticket_open_')) {
    const categoryId = customId.replace('ticket_open_', '');
    const modal = new ModalBuilder()
      .setCustomId(`ticket_modal_create_${categoryId}`)
      .setTitle('Destek & Başvuru Formu');

    const subjectInput = new TextInputBuilder()
      .setCustomId('ticket_subject')
      .setLabel('Talep Konusu')
      .setPlaceholder('Örn: Rol İhlali, Satın Alım, Teknik Sorun')
      .setStyle(TextInputStyle.Short)
      .setMaxLength(100)
      .setRequired(true);

    const descInput = new TextInputBuilder()
      .setCustomId('ticket_description')
      .setLabel('Detaylı Açıklama')
      .setPlaceholder('Lütfen sorununuzu, ilgili kanıtları ve detayları buraya yazınız.')
      .setStyle(TextInputStyle.Paragraph)
      .setMinLength(15)
      .setMaxLength(1000)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(subjectInput),
      new ActionRowBuilder().addComponents(descInput)
    );

    return interaction.showModal(modal);
  }

  // Bilet İçi İşlemler
  const channel = interaction.channel;
  const ticket = db.prepare('SELECT * FROM tickets WHERE channel_id = ?').get(channel.id);
  if (!ticket) return;

  const member = interaction.member;

  // A. Talebi Üstlen (Claim)
  if (customId === 'ticket_claim') {
    if (ticket.claimed_by) {
      return interaction.reply({ content: `Bu talep zaten <@${ticket.claimed_by}> tarafından üstlenilmiş.`, ephemeral: true });
    }

    db.prepare('UPDATE tickets SET claimed_by = ? WHERE channel_id = ?').run(member.id, channel.id);
    await channel.setName(`talep-${member.displayName.slice(0, 10)}`).catch(() => null);

    const claimEmbed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setDescription(`🙋‍♂️ Bu destek talebi <@${member.id}> tarafından üstlenildi. Artık sizinle bu yetkili ilgilenecektir.`);

    return interaction.reply({ embeds: [claimEmbed] });
  }

  // B. Kilitle / Aç
  if (customId === 'ticket_lock') {
    const isLocked = channel.permissionsFor(ticket.user_id)?.has(PermissionFlagsBits.SendMessages) === false;

    await channel.permissionOverwrites.edit(ticket.user_id, {
      SendMessages: isLocked ? true : false
    });

    return interaction.reply({
      content: isLocked ? '🔓 Kullanıcının mesaj yazma kilidi açıldı.' : '🔒 Kullanıcının mesaj yazma yetkisi geçici olarak kilitlendi.',
      ephemeral: true
    });
  }

  // C. Üye Ekle / Çıkar
  if (customId === 'ticket_manage_member') {
    const userSelect = new UserSelectMenuBuilder()
      .setCustomId('ticket_select_member')
      .setPlaceholder('Bilete eklenecek veya çıkarılacak üyeyi seçin');

    return interaction.reply({
      content: '👥 Talebe dahil etmek veya çıkarmak istediğiniz üyeyi seçin:',
      components: [new ActionRowBuilder().addComponents(userSelect)],
      ephemeral: true
    });
  }

  // D. Kapat ve Arşivle (Onay Sor)
  if (customId === 'ticket_close') {
    const confirmRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket_confirm_close').setLabel('Evet, Kapat ve Arşivle').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('ticket_cancel_close').setLabel('İptal').setStyle(ButtonStyle.Secondary)
    );

    return interaction.reply({
      content: '⚠️ Bu destek talebini kapatmak ve tüm konuşmaları arşivlemek istediğinize emin misiniz?',
      components: [confirmRow],
      ephemeral: true
    });
  }

  if (customId === 'ticket_cancel_close') {
    return interaction.update({ content: '❌ Kapatma işlemi iptal edildi.', components: [] });
  }

  if (customId === 'ticket_confirm_close') {
    await interaction.update({ content: '⏳ Talep arşivleniyor ve transkript hazırlanıyor...', components: [] });
    await closeAndArchiveTicket(channel, ticket, interaction.user);
  }
}

// 2. Modal Gönderimi (Bilet Kanalını Oluşturma)
async function handleTicketModal(interaction) {
  if (!interaction.customId.startsWith('ticket_modal_create_')) return;

  const categoryId = interaction.customId.replace('ticket_modal_create_', '');
  const subject = interaction.fields.getTextInputValue('ticket_subject');
  const description = interaction.fields.getTextInputValue('ticket_description');

  const guild = interaction.guild;
  const user = interaction.user;
  const settings = getSettings(guild.id);

  // Kategori bilgilerini çek
  const cat = db.prepare('SELECT * FROM ticket_categories WHERE id = ?').get(categoryId);
  const staffRoleId = cat?.staff_role_id;

  // İzin yapılandırması
  const permissionOverwrites = [
    {
      id: guild.id, // @everyone
      deny: [PermissionFlagsBits.ViewChannel]
    },
    {
      id: user.id, // Talep sahibi
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.ReadMessageHistory
      ]
    }
  ];

  if (staffRoleId) {
    permissionOverwrites.push({
      id: staffRoleId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageMessages
      ]
    });
  }

  try {
    const channel = await guild.channels.create({
      name: `talep-${user.username.slice(0, 15)}`,
      type: ChannelType.GuildText,
      parent: cat?.category_id || undefined,
      permissionOverwrites
    });

    db.prepare(`
      INSERT INTO tickets (channel_id, guild_id, user_id, category_id, subject, description, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(channel.id, guild.id, user.id, categoryId ? parseInt(categoryId, 10) : null, subject, description, Date.now());

    // Bilgilendirme Embed'i
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`🎫 ${cat?.name || 'Destek Talebi'}`)
      .setDescription(`Merhaba <@${user.id}>, talebiniz yetkili ekibimize iletilmiştir. Lütfen sabırla bekleyiniz.`)
      .addFields(
        { name: '📌 Konu', value: subject, inline: false },
        { name: '📝 Açıklama', value: description, inline: false }
      )
      .setFooter({ text: 'Beluga Bilet Yönetim Paneli' })
      .setTimestamp();

    await channel.send({
      content: staffRoleId ? `<@&${staffRoleId}> | <@${user.id}>` : `<@${user.id}>`,
      embeds: [embed],
      components: [getTicketControlRow()]
    });

    return interaction.reply({ content: `✅ Destek talebiniz oluşturuldu: ${channel}`, ephemeral: true });
  } catch (err) {
    console.error('Bilet kanalı oluşturulurken hata:', err);
    return interaction.reply({ content: '❌ Bilet oluşturulurken bir hata oluştu.', ephemeral: true });
  }
}

// 3. Üye Ekle/Çıkar Seçici
async function handleTicketMemberSelect(interaction) {
  if (interaction.customId !== 'ticket_select_member') return;

  const targetUserId = interaction.values[0];
  const channel = interaction.channel;
  const currentPerms = channel.permissionsFor(targetUserId);

  if (currentPerms && currentPerms.has(PermissionFlagsBits.ViewChannel)) {
    // Çıkar
    await channel.permissionOverwrites.delete(targetUserId);
    return interaction.update({ content: `❌ <@${targetUserId}> talepten çıkarıldı.`, components: [] });
  } else {
    // Ekle
    await channel.permissionOverwrites.edit(targetUserId, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
      AttachFiles: true
    });
    return interaction.update({ content: `✅ <@${targetUserId}> talebe dahil edildi.`, components: [] });
  }
}

// 4. Limitsiz fetchAllMessages ve Transkript Çıkarma
async function fetchAllMessages(channel) {
  let messages = [];
  let lastId;

  while (true) {
    const options = { limit: 100 };
    if (lastId) options.before = lastId;

    const fetched = await channel.messages.fetch(options).catch(() => null);
    if (!fetched || fetched.size === 0) break;

    messages = messages.concat(Array.from(fetched.values()));
    lastId = fetched.last().id;
    if (fetched.size < 100) break;
  }

  return messages.reverse(); // Kronolojik sıra
}

async function closeAndArchiveTicket(channel, ticket, closedByUser) {
  const guild = channel.guild;
  const settings = getSettings(guild.id);
  const now = Date.now();

  // Tüm mesajları çek
  const messages = await fetchAllMessages(channel);

  let transcriptText = `=======================================================\n`;
  transcriptText += `BELUGA DESTEK BİLETİ TRANSKRİPTİ\n`;
  transcriptText += `Kanal ID : ${channel.id}\n`;
  transcriptText += `Talep Eden: ${ticket.user_id}\n`;
  transcriptText += `Konu      : ${ticket.subject || 'Belirtilmedi'}\n`;
  transcriptText += `Kapatan   : ${closedByUser ? closedByUser.tag : 'Sistem'}\n`;
  transcriptText += `Tarih     : ${new Date().toLocaleString('tr-TR')}\n`;
  transcriptText += `Toplam Msj: ${messages.length}\n`;
  transcriptText += `=======================================================\n\n`;

  for (const msg of messages) {
    const time = new Date(msg.createdTimestamp).toLocaleTimeString('tr-TR');
    const attachments = msg.attachments.map(a => `[EK: ${a.url}]`).join(' ');
    transcriptText += `[${time}] ${msg.author.tag}: ${msg.cleanContent || ''} ${attachments}\n`;
  }

  const buffer = Buffer.from(transcriptText, 'utf-8');
  const attachment = new AttachmentBuilder(buffer, { name: `transkript-${channel.name}.txt` });

  // Log Kanalına Gönder
  if (settings.log_ticket_archive_id) {
    const logChannel = guild.channels.cache.get(settings.log_ticket_archive_id);
    if (logChannel && logChannel.isTextBased()) {
      const logEmbed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('📁 Destek Talebi Arşivlendi')
        .addFields(
          { name: 'Kanal', value: channel.name, inline: true },
          { name: 'Talep Sahibi', value: `<@${ticket.user_id}>`, inline: true },
          { name: 'Kapatan', value: closedByUser ? `<@${closedByUser.id}>` : 'Sistem', inline: true },
          { name: 'Konu', value: ticket.subject || 'Yok', inline: true },
          { name: 'Toplam Mesaj', value: `${messages.length}`, inline: true }
        )
        .setTimestamp();

      await logChannel.send({ embeds: [logEmbed], files: [attachment] }).catch(() => null);
    }
  }

  // DB durumunu güncelle
  db.prepare('UPDATE tickets SET status = "closed", closed_at = ? WHERE channel_id = ?')
    .run(now, channel.id);

  // Kullanıcıya Geri Bildirim & Puanlama Butonları Gönder (DM veya Kanal)
  try {
    const ticketOwner = await guild.members.fetch(ticket.user_id).catch(() => null);
    if (ticketOwner) {
      const feedbackRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`feedback_1_${channel.id}`).setLabel('⭐').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`feedback_2_${channel.id}`).setLabel('⭐⭐').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`feedback_3_${channel.id}`).setLabel('⭐⭐⭐').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`feedback_4_${channel.id}`).setLabel('⭐⭐⭐⭐').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`feedback_5_${channel.id}`).setLabel('⭐⭐⭐⭐⭐').setStyle(ButtonStyle.Success)
      );

      const feedbackEmbed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('⭐ Destek Deneyiminizi Puanlayın')
        .setDescription(`**"${ticket.subject}"** konulu talebiniz sonuçlandırıldı.\nYetkili ekibimizin hizmetini değerlendirmek için lütfen aşağıdaki yıldızlardan birine tıklayın:`);

      await ticketOwner.send({ embeds: [feedbackEmbed], components: [feedbackRow] }).catch(() => null);
    }
  } catch (e) {}

  // 3 saniye sonra kanalı sil
  setTimeout(() => channel.delete().catch(() => null), 3000);
}

// 5. Geri Bildirim Puanlama Tıklaması
async function handleTicketFeedback(interaction) {
  if (!interaction.customId.startsWith('feedback_')) return;

  const parts = interaction.customId.split('_');
  const stars = parts[1];
  const channelId = parts[2];

  const guild = interaction.client.guilds.cache.first(); // DM'den geldiği için
  const settings = guild ? getSettings(guild.id) : null;

  if (settings && settings.log_ticket_feedback_id) {
    const feedbackChannel = guild.channels.cache.get(settings.log_ticket_feedback_id);
    if (feedbackChannel && feedbackChannel.isTextBased()) {
      const starIcons = '⭐'.repeat(parseInt(stars, 10));
      const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle('🌟 Yeni Destek Memnuniyet Puanı')
        .addFields(
          { name: 'Kullanıcı', value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: true },
          { name: 'Puan', value: `${starIcons} (${stars}/5)`, inline: true }
        )
        .setTimestamp();

      await feedbackChannel.send({ embeds: [embed] }).catch(() => null);
    }
  }

  return interaction.update({ content: `✅ Geri bildiriminiz için teşekkürler! Değerlendirmeniz: **${stars}/5 Yıldız**`, components: [] });
}

// 6. Askıda Kalma Koruması (Üye Sunucudan Çıkarsa)
async function handleMemberLeaveTicketCheck(member) {
  const openTicket = db.prepare('SELECT * FROM tickets WHERE guild_id = ? AND user_id = ? AND status = "open"')
    .get(member.guild.id, member.id);

  if (openTicket) {
    const channel = member.guild.channels.cache.get(openTicket.channel_id);
    if (channel) {
      await channel.send('⚠️ **Talep sahibi sunucudan ayrıldı.** Talep 10 saniye içinde otomatik arşivlenip kapatılıyor...');
      setTimeout(() => closeAndArchiveTicket(channel, openTicket, null), 10000);
    }
  }
}

module.exports = {
  handleTicketButton,
  handleTicketModal,
  handleTicketMemberSelect,
  handleTicketFeedback,
  handleMemberLeaveTicketCheck,
  getTicketControlRow
};


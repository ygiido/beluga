const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getLogChannels, incrementUserViolation } = require('../../database/db');

// Spam ve Flood takip hafızaları
const messageRateHistory = new Map(); // userId -> [timestamps]
const lastMessagesHistory = new Map(); // userId -> { content, count, lastTime }

// Leetspeak harita
const LEET_MAP = {
  '0': 'o', '1': 'i', '!': 'i', '|': 'i', '3': 'e',
  '4': 'a', '@': 'a', '$': 's', '5': 's', '7': 't',
  '8': 'b', 'v': 'u', 'w': 'v'
};

// Kök küfürler
const BAD_WORDS = [
  'amk', 'aq', 'orospu', 'piç', 'pic', 'sik', 'siktir', 'yarrak', 'yarak',
  'göt', 'got', 'kahpe', 'oç', 'oc', 'amcık', 'amcik', 'pezevenk', 'ibne',
  'taşak', 'tasak', 'döl', 'dol'
];

function normalizeText(text) {
  if (!text) return '';
  let cleaned = text.toLowerCase();

  cleaned = cleaned.replace(/[01!|34@$578vw]/g, (char) => LEET_MAP[char] || char);

  cleaned = cleaned
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');

  const noSymbols = cleaned.replace(/[^a-z]/g, '');
  const deDuplicated = noSymbols.replace(/(.)\1+/g, '$1');

  return { cleaned, noSymbols, deDuplicated };
}

function checkCurse(text) {
  const norm = normalizeText(text);

  for (const word of BAD_WORDS) {
    if (
      norm.noSymbols.includes(word) ||
      norm.deDuplicated.includes(word) ||
      norm.cleaned.split(/\s+/).some(w => w === word)
    ) {
      return { hasCurse: true, word };
    }
  }

  return { hasCurse: false };
}

function checkFlood(message, now) {
  const userId = message.author.id;
  const content = message.content.trim().toLowerCase();

  // 1. Karakter uzatma / flood (örn: aaaaaaaaaaaaaaaaaaaaaaaaaa 40+ harf)
  if (/(.)\1{30,}/i.test(message.content)) {
    return { isFlood: true, reason: 'Karakter Uzatma Flood\'u' };
  }

  // 2. Çoklu satır boşluk flood'u (15+ satır atlama)
  if ((message.content.match(/\n/g) || []).length >= 15) {
    return { isFlood: true, reason: 'Aşırı Satır Atlama Flood\'u' };
  }

  // 3. Aynı mesajı art arda kopyalayıp atma (10 saniyede 3 kez aynı mesaj)
  const prev = lastMessagesHistory.get(userId);
  if (prev && prev.content === content && (now - prev.lastTime < 10000)) {
    const repeatCount = prev.count + 1;
    lastMessagesHistory.set(userId, { content, count: repeatCount, lastTime: now });
    if (repeatCount >= 3) {
      return { isFlood: true, reason: 'Aynı Mesajı Tekrarlama Flood\'u' };
    }
  } else {
    lastMessagesHistory.set(userId, { content, count: 1, lastTime: now });
  }

  return { isFlood: false };
}

function checkSpam(userId, now) {
  const userTimestamps = messageRateHistory.get(userId) || [];
  const recent = userTimestamps.filter(t => now - t < 3000);
  recent.push(now);
  messageRateHistory.set(userId, recent);

  // 3 saniyede 4+ mesaj
  if (recent.length >= 4) {
    messageRateHistory.delete(userId);
    return { isSpam: true };
  }

  return { isSpam: false };
}

// Süreyi insan dostu formatlama
function formatDuration(minutes) {
  if (minutes < 60) return `${minutes} dakika`;
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  if (hours < 24) {
    return `${hours} saat${remainingMins > 0 ? ` ${remainingMins} dakika` : ''}`;
  }
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return `${days} gün${remainingHours > 0 ? ` ${remainingHours} saat` : ''}`;
}

async function handleAutoModeration(message) {
  if (!message.guild || message.author.bot || !message.member) return;

  const settings = getLogChannels(message.guild.id);
  // Küfür/Spam/Flood koruması kapalıysa işlem yapma
  if (settings.auto_timeout_enabled === 0) return;

  // Yetkilileri muaf tut
  if (
    message.member.permissions.has(PermissionFlagsBits.ManageMessages) ||
    message.member.permissions.has(PermissionFlagsBits.Administrator)
  ) {
    return;
  }

  const now = Date.now();
  const userId = message.author.id;
  const guild = message.guild;

  let violationType = null;

  // 1. Küfür Kontrolü
  const curse = checkCurse(message.content);
  if (curse.hasCurse) {
    violationType = 'Küfür / Hakaret';
  }

  // 2. Spam Kontrolü
  if (!violationType) {
    const spam = checkSpam(userId, now);
    if (spam.isSpam) {
      violationType = 'Seri Mesaj Spamı';
    }
  }

  // 3. Flood Kontrolü
  if (!violationType) {
    const flood = checkFlood(message, now);
    if (flood.isFlood) {
      violationType = flood.reason;
    }
  }

  if (!violationType) return;

  // İhlali gerçekleştir: Mesajı sil
  try {
    await message.delete();
  } catch (e) {}

  // İhlal sayacını katla
  const count = incrementUserViolation(guild.id, userId);

  // Katlanan Zaman Aşımı Süresi:
  // 1. İhlal: 20 dakika
  // 2. İhlal: 40 dakika (20 * 2^1)
  // 3. İhlal: 80 dakika (20 * 2^2)
  // 4. İhlal: 160 dakika ...
  const durationMinutes = 20 * Math.pow(2, count - 1);

  // Discord maksimum 28 gün (40320 dakika) timeout'a izin verir
  const cappedMinutes = Math.min(durationMinutes, 28 * 24 * 60);
  const durationMs = cappedMinutes * 60 * 1000;
  const durationText = formatDuration(cappedMinutes);

  try {
    await message.member.timeout(durationMs, `Otomatik Ceza: ${violationType} (İhlal #${count})`);

    // Kanala uyarı bildirimi gönder (8 saniye sonra silinir)
    const warnEmbed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle('⏳ Otomatik Zaman Aşımı (Timeout)')
      .setDescription(
        `🚨 <@${userId}> (**${message.author.tag}**), **${violationType}** nedeniyle Discord tarafından **${durationText}** zaman aşımına uğratıldı!\n\n` +
        `• **Ceza Seviyesi:** İhlal **#${count}**\n` +
        `• *Bilgi: Her ihlalde ceza süresi 20 dakikadan başlayarak 2 katına katlanır.*`
      )
      .setFooter({ text: 'Bu bildirim 8 saniye sonra silinecektir.' });

    const warnMsg = await message.channel.send({ embeds: [warnEmbed] }).catch(() => null);
    if (warnMsg) {
      setTimeout(() => warnMsg.delete().catch(() => null), 8000);
    }

    // Log kanalına detaylı rapor bas
    const settings = getLogChannels(guild.id);
    const targetLogId = settings.member_log || settings.security_log;

    if (targetLogId) {
      const logChannel = guild.channels.cache.get(targetLogId);
      if (logChannel && logChannel.isTextBased()) {
        const logEmbed = new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle('🔨 Otomatik Kademeli Timeout Uygulandı')
          .addFields(
            { name: 'Kullanıcı', value: `<@${userId}> (${message.author.tag})`, inline: true },
            { name: 'Sebep', value: violationType, inline: true },
            { name: 'Uygulanan Süre', value: `⏱️ **${durationText}**`, inline: true },
            { name: 'Toplam İhlal Sayısı', value: `\`${count}. İhlal\``, inline: true },
            { name: 'Kanal', value: `<#${message.channel.id}>`, inline: true },
            { name: 'Silinen Mesaj', value: message.cleanContent ? (message.cleanContent.length > 500 ? message.cleanContent.slice(0, 500) + '...' : message.cleanContent) : '*İçerik yok*', inline: false }
          )
          .setFooter({ text: 'Beluga Auto-Moderation Engine' })
          .setTimestamp();

        logChannel.send({ embeds: [logEmbed] }).catch(() => null);
      }
    }
  } catch (err) {
    console.error(`Timeout uygulanamadı (<@${userId}>):`, err.message);
  }
}

module.exports = {
  handleAutoModeration
};


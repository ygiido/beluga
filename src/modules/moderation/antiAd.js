const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getLogChannels, incrementAdViolation, db } = require('../../database/db');

// Reklam ve Link Regex Kalıpları (Anti-Bypass destekli)
const DISCORD_INVITE_REGEX = /(discord(?:app)?\.(?:com\/invite|gg)|discord\.me|discord\.io|dsc\.gg|invite\.gg)\/[a-zA-Z0-9-._]+/i;
const BYPASS_INVITE_REGEX = /discord\s*(?:\.|\(|\)|\[|\]|,|\s+dot\s+|\s+nokta\s*)\s*gg\s*(?:\/|\s+)\s*[a-zA-Z0-9-._]+/i;

const GENERAL_URL_REGEX = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/i;
const TLD_REGEX = /\b[a-zA-Z0-9-]{2,}\.(com|net|org|xyz|gg|ru|io|site|me|online|live|club|shop|top|click|info|pro|link|cc|to|ly|tk|ml|ga|cf|gq)(\/[^\s]*)?/i;
const BYPASS_DOT_REGEX = /[a-zA-Z0-9-]{2,}\s*(?:\.|\(|\)|\[|\]|,|\s+dot\s+|\s+nokta\s*)\s*(com|net|org|xyz|gg|ru|io|site|me|online|live|top|click)(\/[^\s]*)?/i;

function checkAdOrLink(content) {
  if (!content) return { isAd: false };

  // 1. Discord Davet Linki
  if (DISCORD_INVITE_REGEX.test(content) || BYPASS_INVITE_REGEX.test(content)) {
    return { isAd: true, type: 'Discord Sunucu Davet Linki' };
  }

  // 2. Genel Web Bağlantısı
  if (GENERAL_URL_REGEX.test(content) || TLD_REGEX.test(content) || BYPASS_DOT_REGEX.test(content)) {
    return { isAd: true, type: 'Harici Web Linki / Reklam' };
  }

  return { isAd: false };
}

async function handleAntiAd(message) {
  if (!message.guild || message.author.bot || !message.member) return false;

  const settings = getLogChannels(message.guild.id);
  // Reklam koruması kapalıysa işlem yapma
  if (settings.anti_ad_enabled === 0) return false;

  // Yetkilileri muaf tut
  if (
    message.member.permissions.has(PermissionFlagsBits.ManageMessages) ||
    message.member.permissions.has(PermissionFlagsBits.Administrator)
  ) {
    return false;
  }

  const check = checkAdOrLink(message.content);
  if (!check.isAd) return false;

  const guild = message.guild;
  const member = message.member;
  const userId = message.author.id;
  const deletedContent = message.cleanContent || message.content;

  // 1. Mesajı derhal sessizce sil (Kanalda bildirim/uyarı atılmaz!)
  try {
    await message.delete();
  } catch (e) {}

  // 2. İhlal sayacını al
  const count = incrementAdViolation(guild.id, userId);

  let actionTaken = '';
  let color = 0xED4245;

  if (count === 1) {
    // 1. İhlal: 1 Saat Discord Native Timeout
    const duration = 60 * 60 * 1000;
    try {
      await member.timeout(duration, `Uyarısız Reklam Engeli (1. İhlal - 1 Saat Timeout)`);
      actionTaken = '⏳ **1 Saat Zaman Aşımı (Timeout)** uygulandı.';
    } catch (err) {
      actionTaken = '⚠️ Timeout uygulanamadı (Yetki yetersiz).';
    }
  } else if (count === 2) {
    // 2. İhlal: 1 Gün Discord Native Timeout
    const duration = 24 * 60 * 60 * 1000;
    try {
      await member.timeout(duration, `Uyarısız Reklam Engeli (2. İhlal - 1 Gün Timeout)`);
      actionTaken = '⏳ **24 Saat (1 Gün) Zaman Aşımı (Timeout)** uygulandı.';
    } catch (err) {
      actionTaken = '⚠️ Timeout uygulanamadı (Yetki yetersiz).';
    }
  } else if (count >= 3) {
    // 3. İhlal: SUNUCUDAN ATMA (KICK)
    try {
      await member.kick(`Uyarısız Reklam Engeli (3. İhlal - Sunucudan Atıldı)`);
      db.prepare('DELETE FROM user_ad_violations WHERE guild_id = ? AND user_id = ?').run(guild.id, userId);
      actionTaken = '👢 **3. Reklam İhlali Nedeniyle Sunucudan Atıldı (KICK)!**';
      color = 0x8B0000;
    } catch (err) {
      actionTaken = '⚠️ Sunucudan atılamadı (Yetki hiyerarşisi engeli).';
    }
  }

  // 3. Güvenlik Denetim Loguna Raporla (Kanalda sessiz kalırken yetkilileri bilgilendirir)
  const targetLogId = settings.security_log || settings.member_log || settings.message_log;

  if (targetLogId) {
    const logChannel = guild.channels.cache.get(targetLogId);
    if (logChannel && logChannel.isTextBased()) {
      const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle('🚫 Reklam / Link Engellendi (Uyarısız Ceza)')
        .setDescription(`<@${userId}> (**${message.author.tag}**) tarafından paylaşılan reklam/link silindi.`)
        .addFields(
          { name: 'Kullanıcı', value: `<@${userId}> (${message.author.tag})`, inline: true },
          { name: 'İhlal Türü', value: check.type, inline: true },
          { name: 'Ceza Seviyesi', value: `\`${count}. İhlal\``, inline: true },
          { name: 'Uygulanan İşlem', value: actionTaken, inline: false },
          { name: 'Paylaşılan Kanal', value: `<#${message.channel.id}>`, inline: true },
          { name: 'Engellenen İçerik', value: deletedContent ? (deletedContent.length > 500 ? deletedContent.slice(0, 500) + '...' : deletedContent) : '*Link*', inline: false }
        )
        .setFooter({ text: 'Beluga Uyarısız Anti-Reklam Motoru • 3. İhlalde Kick' })
        .setTimestamp();

      logChannel.send({ embeds: [embed] }).catch(() => null);
    }
  }

  return true; // Reklam olduğu için diğer kontrollere geçmeyi durdur
}

module.exports = {
  handleAntiAd,
  checkAdOrLink
};


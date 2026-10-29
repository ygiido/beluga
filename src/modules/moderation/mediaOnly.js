const { PermissionFlagsBits } = require('discord.js');
const { db } = require('../../database/db');

// Medya format ve servis regex'leri
const MEDIA_EXTENSIONS = /\.(png|jpe?g|gif|webp|mp4|mov|avi|webm|mkv)(\?.*)?$/i;
const MEDIA_DOMAINS = /(tenor\.com|giphy\.com|gfycat\.com|imgur\.com|tiktok\.com|instagram\.com|youtube\.com|youtu\.be|streamable\.com|medal\.tv)/i;

function hasMedia(message) {
  // 1. Doğrudan dosya/görsel eki var mı?
  if (message.attachments.size > 0) return true;

  // 2. Mesaj içeriğinde görsel/video linki veya medya servisi var mı?
  const words = message.content.split(/\s+/);
  for (const word of words) {
    if (MEDIA_EXTENSIONS.test(word) || MEDIA_DOMAINS.test(word)) {
      return true;
    }
  }

  return false;
}

async function handleMediaOnly(message) {
  if (!message.guild || message.author.bot || !message.member) return false;

  // Bu kanal Sadece-Medya listesinde mi?
  const isMediaOnly = db.prepare('SELECT 1 FROM media_only_channels WHERE guild_id = ? AND channel_id = ?')
    .get(message.guild.id, message.channel.id);

  if (!isMediaOnly) return false;

  // Yetkililer muaf
  if (
    message.member.permissions.has(PermissionFlagsBits.ManageMessages) ||
    message.member.permissions.has(PermissionFlagsBits.Administrator)
  ) {
    return false;
  }

  // Medya var mı?
  if (hasMedia(message)) return false;

  // Medya yoksa sil ve geçici uyar
  try {
    await message.delete();
    const warn = await message.channel.send(`⚠️ <@${message.author.id}>, bu kanala **yalnızca fotoğraf veya video** gönderebilirsiniz.`);
    setTimeout(() => warn.delete().catch(() => null), 5000);
  } catch (e) {}

  return true;
}

module.exports = {
  handleMediaOnly
};


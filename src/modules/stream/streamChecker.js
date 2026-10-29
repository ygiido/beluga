const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { db, getStreamSettings } = require('../../database/db');

// Kick kanalını kontrol etme
async function checkKickChannel(channelSlug) {
  try {
    const slug = channelSlug.replace(/https?:\/\/(www\.)?kick\.com\//i, '').replace(/[\/\?].*$/, '').trim();
    const url = `https://kick.com/api/v2/channels/${slug}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      }
    });

    if (!res.ok) return { isLive: false };
    const data = await res.json();

    if (data && data.livestream) {
      return {
        isLive: true,
        streamId: `${data.livestream.id}`,
        title: data.livestream.session_title || 'Canlı Yayın',
        category: data.livestream.categories?.[0]?.name || 'Just Chatting',
        viewers: data.livestream.viewer_count || 0,
        thumbnail: data.livestream.thumbnail?.url || data.user?.profile_pic,
        avatar: data.user?.profile_pic,
        streamUrl: `https://kick.com/${slug}`,
        streamerName: data.user?.username || slug
      };
    }
    return { isLive: false };
  } catch (err) {
    return { isLive: false };
  }
}

// YouTube kanalını kontrol etme
async function checkYouTubeChannel(channelInput) {
  try {
    let cleanUrl = channelInput.trim();
    if (!cleanUrl.startsWith('http')) {
      if (cleanUrl.startsWith('@')) cleanUrl = `https://www.youtube.com/${cleanUrl}`;
      else if (cleanUrl.startsWith('UC')) cleanUrl = `https://www.youtube.com/channel/${cleanUrl}`;
      else cleanUrl = `https://www.youtube.com/@${cleanUrl}`;
    }

    const liveUrl = cleanUrl.endsWith('/live') ? cleanUrl : `${cleanUrl.replace(/\/$/, '')}/live`;
    const res = await fetch(liveUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7'
      },
      redirect: 'follow'
    });

    if (!res.ok) return { isLive: false };
    const html = await res.text();

    const isLive = html.includes('"isLive":true') || html.includes('"status":"LIVE"') || html.includes('isLiveBroadcast');
    if (!isLive) return { isLive: false };

    // Başlık ve Video ID çekme
    const titleMatch = html.match(/<meta property="og:title" content="([^"]+)">/) || html.match(/<title>([^<]+)<\/title>/);
    const title = titleMatch ? titleMatch[1].replace(' - YouTube', '') : 'YouTube Canlı Yayını';

    const videoIdMatch = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
    const videoId = videoIdMatch ? videoIdMatch[1] : null;

    const imageMatch = html.match(/<meta property="og:image" content="([^"]+)">/);
    const thumbnail = imageMatch ? imageMatch[1] : (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null);

    const streamUrl = videoId ? `https://www.youtube.com/watch?v=${videoId}` : liveUrl;

    return {
      isLive: true,
      streamId: videoId || liveUrl,
      title,
      category: 'YouTube Canlı',
      thumbnail,
      streamUrl,
      streamerName: titleMatch ? titleMatch[1] : 'YouTube Kanalı'
    };
  } catch (err) {
    return { isLive: false };
  }
}

// Canlı Yayın Duyuru Döngüsü
function initStreamNotificationScheduler(client) {
  const runCheck = async () => {
    const streamers = db.prepare('SELECT * FROM streamers').all();
    if (streamers.length === 0) return;

    for (const streamer of streamers) {
      try {
        let streamInfo = { isLive: false };

        if (streamer.platform.toLowerCase() === 'kick') {
          streamInfo = await checkKickChannel(streamer.channel_url);
        } else if (streamer.platform.toLowerCase() === 'youtube') {
          streamInfo = await checkYouTubeChannel(streamer.channel_url);
        }

        const now = Date.now();

        // 1. Yeni Canlı Yayına Girdi (Bot kapalıyken bile başlasa yakalar!)
        if (streamInfo.isLive && (!streamer.is_live || (streamInfo.streamId && streamInfo.streamId !== streamer.last_stream_id))) {
          db.prepare('UPDATE streamers SET is_live = 1, last_stream_id = ?, last_checked_at = ? WHERE id = ?')
            .run(streamInfo.streamId, now, streamer.id);

          const guild = client.guilds.cache.get(streamer.guild_id);
          if (!guild) continue;

          const streamSettings = getStreamSettings(guild.id);
          if (!streamSettings.announcement_channel_id) continue;

          const notifyChannel = guild.channels.cache.get(streamSettings.announcement_channel_id);
          if (!notifyChannel || !notifyChannel.isTextBased()) continue;

          // Ping mesajı
          let pingText = '';
          if (streamSettings.ping_role_id === 'everyone') pingText = '@everyone';
          else if (streamSettings.ping_role_id === 'here') pingText = '@here';
          else if (streamSettings.ping_role_id) pingText = `<@&${streamSettings.ping_role_id}>`;

          const brandColor = streamer.platform.toLowerCase() === 'kick' ? 0x53FC18 : 0xFF0000;

          const embed = new EmbedBuilder()
            .setColor(brandColor)
            .setAuthor({
              name: `${streamer.channel_name} (${streamer.platform.toUpperCase()})`,
              iconURL: streamInfo.avatar || undefined,
              url: streamInfo.streamUrl
            })
            .setTitle(streamInfo.title || 'Canlı Yayın Başladı!')
            .setURL(streamInfo.streamUrl)
            .setDescription(
              `🎮 **Kategori:** ${streamInfo.category || 'Genel'}` +
              (streamInfo.viewers ? `\n👀 **İzleyici:** ${streamInfo.viewers.toLocaleString('tr-TR')}` : '')
            );

          if (streamInfo.thumbnail) embed.setImage(streamInfo.thumbnail);
          embed.setFooter({ text: `${streamer.platform.toUpperCase()}` }).setTimestamp();

          // Buton (Sade ve net)
          const buttonRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setLabel('▶️ Yayını İzle')
              .setStyle(ButtonStyle.Link)
              .setURL(streamInfo.streamUrl)
          );

          await notifyChannel.send({
            content: pingText ? `${pingText} 🔴 **${streamer.channel_name}** yayında!` : `🔴 **${streamer.channel_name}** yayında!`,
            embeds: [embed],
            components: [buttonRow]
          }).catch(() => null);
        }

        // 2. Yayın Bitti
        if (!streamInfo.isLive && streamer.is_live) {
          db.prepare('UPDATE streamers SET is_live = 0, last_checked_at = ? WHERE id = ?')
            .run(now, streamer.id);
        }
      } catch (err) {
        console.error(`Yayın kontrol hatası (${streamer.channel_name}):`, err);
      }
    }
  };

  // Bot açılır açılmaz beklemeden ilk taramayı hemen yap
  runCheck();

  // Sonrasında her 60 saniyede bir periyodik tara
  setInterval(runCheck, 60000);
}

module.exports = {
  checkKickChannel,
  checkYouTubeChannel,
  initStreamNotificationScheduler
};


const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '../../data/beluga.sqlite');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS guild_log_channels (
    guild_id TEXT PRIMARY KEY,
    message_log TEXT,
    media_log TEXT,
    voice_log TEXT,
    member_log TEXT,
    server_log TEXT,
    security_log TEXT,
    anti_nuke_enabled INTEGER DEFAULT 1,
    media_recovery_enabled INTEGER DEFAULT 1,
    anti_ad_enabled INTEGER DEFAULT 1,
    auto_timeout_enabled INTEGER DEFAULT 1,
    temp_voice_channel_id TEXT,
    temp_voice_category_id TEXT
  );

  CREATE TABLE IF NOT EXISTS voice_sessions (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    joined_at INTEGER NOT NULL,
    PRIMARY KEY (guild_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS guild_invites (
    guild_id TEXT NOT NULL,
    code TEXT NOT NULL,
    inviter_id TEXT,
    uses INTEGER DEFAULT 0,
    PRIMARY KEY (guild_id, code)
  );

  CREATE TABLE IF NOT EXISTS member_joins (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    inviter_id TEXT,
    joined_at INTEGER NOT NULL,
    PRIMARY KEY (guild_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS stream_settings (
    guild_id TEXT PRIMARY KEY,
    announcement_channel_id TEXT,
    ping_role_id TEXT,
    custom_message TEXT DEFAULT '{streamer} şu anda canlı yayında!'
  );

  CREATE TABLE IF NOT EXISTS streamers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    platform TEXT NOT NULL,
    channel_name TEXT NOT NULL,
    channel_url TEXT NOT NULL,
    is_live INTEGER DEFAULT 0,
    last_stream_id TEXT,
    last_checked_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS user_violations (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    violation_count INTEGER DEFAULT 0,
    last_violation_at INTEGER,
    PRIMARY KEY (guild_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS user_ad_violations (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    count INTEGER DEFAULT 0,
    last_at INTEGER,
    PRIMARY KEY (guild_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS temp_voices (
    channel_id TEXT PRIMARY KEY,
    guild_id TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    is_locked INTEGER DEFAULT 0,
    is_hidden INTEGER DEFAULT 0,
    user_limit INTEGER DEFAULT 0,
    control_message_id TEXT
  );

  CREATE TABLE IF NOT EXISTS media_only_channels (
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    PRIMARY KEY (guild_id, channel_id)
  );
`);

// Eski tablolarda sütun yoksa güvenle ekle
try { db.exec('ALTER TABLE guild_log_channels ADD COLUMN anti_ad_enabled INTEGER DEFAULT 1'); } catch (e) {}
try { db.exec('ALTER TABLE guild_log_channels ADD COLUMN auto_timeout_enabled INTEGER DEFAULT 1'); } catch (e) {}
try { db.exec('ALTER TABLE guild_log_channels ADD COLUMN temp_voice_channel_id TEXT'); } catch (e) {}
try { db.exec('ALTER TABLE guild_log_channels ADD COLUMN temp_voice_category_id TEXT'); } catch (e) {}

function getLogChannels(guildId) {
  let row = db.prepare('SELECT * FROM guild_log_channels WHERE guild_id = ?').get(guildId);
  if (!row) {
    db.prepare('INSERT OR IGNORE INTO guild_log_channels (guild_id) VALUES (?)').run(guildId);
    row = db.prepare('SELECT * FROM guild_log_channels WHERE guild_id = ?').get(guildId);
  }
  return row;
}

function updateLogChannel(guildId, field, channelId) {
  getLogChannels(guildId);
  db.prepare(`UPDATE guild_log_channels SET ${field} = ? WHERE guild_id = ?`).run(channelId, guildId);
}

function getStreamSettings(guildId) {
  let row = db.prepare('SELECT * FROM stream_settings WHERE guild_id = ?').get(guildId);
  if (!row) {
    db.prepare('INSERT OR IGNORE INTO stream_settings (guild_id) VALUES (?)').run(guildId);
    row = db.prepare('SELECT * FROM stream_settings WHERE guild_id = ?').get(guildId);
  }
  return row;
}

function updateStreamSettings(guildId, field, value) {
  getStreamSettings(guildId);
  db.prepare(`UPDATE stream_settings SET ${field} = ? WHERE guild_id = ?`).run(value, guildId);
}

function incrementUserViolation(guildId, userId) {
  const existing = db.prepare('SELECT * FROM user_violations WHERE guild_id = ? AND user_id = ?').get(guildId, userId);
  const now = Date.now();
  let count = 1;

  if (existing) {
    count = existing.violation_count + 1;
    db.prepare('UPDATE user_violations SET violation_count = ?, last_violation_at = ? WHERE guild_id = ? AND user_id = ?')
      .run(count, now, guildId, userId);
  } else {
    db.prepare('INSERT INTO user_violations (guild_id, user_id, violation_count, last_violation_at) VALUES (?, ?, 1, ?)')
      .run(guildId, userId, now);
  }

  return count;
}

function incrementAdViolation(guildId, userId) {
  const existing = db.prepare('SELECT * FROM user_ad_violations WHERE guild_id = ? AND user_id = ?').get(guildId, userId);
  const now = Date.now();
  let count = 1;

  if (existing) {
    count = existing.count + 1;
    db.prepare('UPDATE user_ad_violations SET count = ?, last_at = ? WHERE guild_id = ? AND user_id = ?')
      .run(count, now, guildId, userId);
  } else {
    db.prepare('INSERT INTO user_ad_violations (guild_id, user_id, count, last_at) VALUES (?, ?, 1, ?)')
      .run(guildId, userId, now);
  }

  return count;
}

module.exports = {
  db,
  getLogChannels,
  updateLogChannel,
  getStreamSettings,
  updateStreamSettings,
  incrementUserViolation,
  incrementAdViolation
};

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
    media_recovery_enabled INTEGER DEFAULT 1
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
`);

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

module.exports = {
  db,
  getLogChannels,
  updateLogChannel
};

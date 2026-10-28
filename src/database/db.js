const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '../../data/beluga.sqlite');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Tabloları oluştur
db.exec(`
  CREATE TABLE IF NOT EXISTS guild_settings (
    guild_id TEXT PRIMARY KEY,
    jail_role_id TEXT,
    sicilli_role_id TEXT,
    temp_voice_channel_id TEXT,
    temp_voice_category_id TEXT,
    temp_voice_name_template TEXT DEFAULT '🔊 {user}''nin Odası',
    log_message_channel_id TEXT,
    log_media_channel_id TEXT,
    log_voice_channel_id TEXT,
    log_mod_channel_id TEXT,
    log_security_channel_id TEXT,
    log_join_channel_id TEXT,
    log_ticket_archive_id TEXT,
    log_ticket_feedback_id TEXT,
    anti_curse_enabled INTEGER DEFAULT 1,
    anti_spam_enabled INTEGER DEFAULT 1,
    anti_scam_enabled INTEGER DEFAULT 1,
    anti_nuke_enabled INTEGER DEFAULT 1,
    media_recovery_enabled INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS infractions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    reason TEXT,
    points INTEGER DEFAULT 1,
    created_at INTEGER NOT NULL,
    expires_at INTEGER,
    is_active INTEGER DEFAULT 1,
    previous_roles TEXT
  );

  CREATE TABLE IF NOT EXISTS temp_voices (
    channel_id TEXT PRIMARY KEY,
    guild_id TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    is_locked INTEGER DEFAULT 0,
    is_hidden INTEGER DEFAULT 0,
    text_locked INTEGER DEFAULT 0,
    user_limit INTEGER DEFAULT 0,
    control_message_id TEXT
  );

  CREATE TABLE IF NOT EXISTS temp_voice_preferences (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    channel_name TEXT,
    is_locked INTEGER DEFAULT 0,
    user_limit INTEGER DEFAULT 0,
    PRIMARY KEY (guild_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS ticket_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    name TEXT NOT NULL,
    staff_role_id TEXT,
    category_id TEXT,
    welcome_message TEXT
  );

  CREATE TABLE IF NOT EXISTS tickets (
    channel_id TEXT PRIMARY KEY,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    category_id INTEGER,
    subject TEXT,
    description TEXT,
    status TEXT DEFAULT 'open',
    claimed_by TEXT,
    created_at INTEGER NOT NULL,
    closed_at INTEGER
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

// Yardımcı DB fonksiyonları
const getSettings = (guildId) => {
  const row = db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get(guildId);
  if (!row) {
    db.prepare('INSERT OR IGNORE INTO guild_settings (guild_id) VALUES (?)').run(guildId);
    return db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get(guildId);
  }
  return row;
};

const updateSettings = (guildId, field, value) => {
  getSettings(guildId);
  return db.prepare(`UPDATE guild_settings SET ${field} = ? WHERE guild_id = ?`).run(value, guildId);
};

module.exports = {
  db,
  getSettings,
  updateSettings
};


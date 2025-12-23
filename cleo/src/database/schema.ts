export const SCHEMA_VERSION = 2;

export const CREATE_CHORES_TABLE = `
CREATE TABLE IF NOT EXISTS chores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  frequency_hours INTEGER NOT NULL,
  priority INTEGER DEFAULT 1,
  active INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
`;

export const CREATE_CHORE_HISTORY_TABLE = `
CREATE TABLE IF NOT EXISTS chore_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chore_id INTEGER NOT NULL,
  completed_at INTEGER NOT NULL,
  completed_by TEXT,
  notes TEXT,
  FOREIGN KEY (chore_id) REFERENCES chores(id) ON DELETE CASCADE
);
`;

export const CREATE_CHORE_HISTORY_INDEX = `
CREATE INDEX IF NOT EXISTS idx_chore_history_chore_completed
  ON chore_history(chore_id, completed_at DESC);
`;

export const CREATE_CHAT_MESSAGES_TABLE = `
CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id INTEGER NOT NULL,
  message_id INTEGER NOT NULL,
  user_id INTEGER,
  username TEXT,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  model_used TEXT
);
`;

export const CREATE_CHAT_MESSAGES_INDEX = `
CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_timestamp
  ON chat_messages(chat_id, timestamp DESC);
`;

export const CREATE_GARBAGE_SCHEDULE_TABLE = `
CREATE TABLE IF NOT EXISTS garbage_schedule (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scheduled_date TEXT NOT NULL,
  garbage_type TEXT NOT NULL,
  description TEXT,
  created_at INTEGER NOT NULL
);
`;

export const CREATE_GARBAGE_SCHEDULE_INDEX = `
CREATE INDEX IF NOT EXISTS idx_garbage_schedule_date
  ON garbage_schedule(scheduled_date ASC);
`;

export const CREATE_SYSTEM_STATE_TABLE = `
CREATE TABLE IF NOT EXISTS system_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
`;

export const DEFAULT_CHORES = [
  {
    name: 'vacuuming',
    description: 'Vacuum the living room and bedrooms',
    frequency_hours: 168, // weekly
    priority: 2,
  },
  {
    name: 'litterbox',
    description: 'Clean the cat litterbox',
    frequency_hours: 24, // daily
    priority: 3,
  },
  {
    name: 'trash',
    description: 'Take out the trash',
    frequency_hours: 72, // 3 days
    priority: 2,
  },
  {
    name: 'dishes',
    description: 'Do the dishes',
    frequency_hours: 24, // daily
    priority: 2,
  },
];

export const ALL_SCHEMAS = [
  CREATE_CHORES_TABLE,
  CREATE_CHORE_HISTORY_TABLE,
  CREATE_CHORE_HISTORY_INDEX,
  CREATE_CHAT_MESSAGES_TABLE,
  CREATE_CHAT_MESSAGES_INDEX,
  CREATE_GARBAGE_SCHEDULE_TABLE,
  CREATE_GARBAGE_SCHEDULE_INDEX,
  CREATE_SYSTEM_STATE_TABLE,
];

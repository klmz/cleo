import Database from 'better-sqlite3';
import { ALL_SCHEMAS, DEFAULT_CHORES, SCHEMA_VERSION } from './schema';
import { logger } from '../utils/logger';

let db: Database.Database | null = null;

export function initializeDatabase(dbPath: string): Database.Database {
  logger.info(`Initializing database at ${dbPath}`);

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  runMigrations(db);
  seedDefaultData(db);

  logger.info('Database initialized successfully');
  return db;
}

function runMigrations(database: Database.Database): void {
  logger.info('Running database migrations');

  const getCurrentVersion = database.prepare(
    `SELECT value FROM system_state WHERE key = 'schema_version'`
  );

  let currentVersion = 0;
  try {
    const row = getCurrentVersion.get() as { value: string } | undefined;
    currentVersion = row ? parseInt(row.value, 10) : 0;
  } catch (error) {
    logger.debug('System state table does not exist yet, starting from version 0');
  }

  if (currentVersion >= SCHEMA_VERSION) {
    logger.info(`Database schema is up to date (version ${currentVersion})`);
    return;
  }

  logger.info(`Migrating database from version ${currentVersion} to ${SCHEMA_VERSION}`);

  const transaction = database.transaction(() => {
    for (const schema of ALL_SCHEMAS) {
      database.exec(schema);
    }

    database
      .prepare(
        `INSERT OR REPLACE INTO system_state (key, value, updated_at) VALUES (?, ?, ?)`
      )
      .run('schema_version', SCHEMA_VERSION.toString(), Date.now());
  });

  transaction();
  logger.info('Database migration completed successfully');
}

function seedDefaultData(database: Database.Database): void {
  const checkChores = database.prepare(`SELECT COUNT(*) as count FROM chores`);
  const result = checkChores.get() as { count: number };

  if (result.count > 0) {
    logger.debug('Database already contains chores, skipping seed data');
    return;
  }

  logger.info('Seeding default chores');

  const insertChore = database.prepare(`
    INSERT INTO chores (name, description, frequency_hours, priority, active, created_at, updated_at)
    VALUES (?, ?, ?, ?, 1, ?, ?)
  `);

  const transaction = database.transaction(() => {
    const now = Date.now();
    for (const chore of DEFAULT_CHORES) {
      insertChore.run(
        chore.name,
        chore.description,
        chore.frequency_hours,
        chore.priority,
        now,
        now
      );
    }
  });

  transaction();
  logger.info(`Seeded ${DEFAULT_CHORES.length} default chores`);
}

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase first.');
  }
  return db;
}

export function closeDatabase(): void {
  if (db) {
    logger.info('Closing database connection');
    db.close();
    db = null;
  }
}

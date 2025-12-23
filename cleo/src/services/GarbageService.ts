import { Database } from 'better-sqlite3';
import { getDatabase } from '../database/db';
import { logger } from '../utils/logger';

export interface GarbageScheduleEntry {
    id: number;
    scheduled_date: string; // YYYY-MM-DD
    garbage_type: string;
    description?: string;
    created_at: number;
}

export class GarbageService {
    private get db(): Database {
        return getDatabase();
    }

    getAll(): GarbageScheduleEntry[] {
        try {
            const stmt = this.db.prepare(
                'SELECT * FROM garbage_schedule ORDER BY scheduled_date ASC'
            );
            return stmt.all() as GarbageScheduleEntry[];
        } catch (error) {
            logger.error(`Failed to get garbage schedule: ${error}`);
            return [];
        }
    }

    getUpcoming(limit: number = 5): GarbageScheduleEntry[] {
        try {
            const today = new Date().toISOString().split('T')[0];
            const stmt = this.db.prepare(
                'SELECT * FROM garbage_schedule WHERE scheduled_date >= ? ORDER BY scheduled_date ASC LIMIT ?'
            );
            return stmt.all(today, limit) as GarbageScheduleEntry[];
        } catch (error) {
            logger.error(`Failed to get upcoming garbage schedule: ${error}`);
            return [];
        }
    }

    add(date: string, type: string, description?: string): GarbageScheduleEntry {
        try {
            const stmt = this.db.prepare(`
        INSERT INTO garbage_schedule (scheduled_date, garbage_type, description, created_at)
        VALUES (?, ?, ?, ?)
      `);

            const now = Date.now();
            const result = stmt.run(date, type, description || null, now);

            return {
                id: result.lastInsertRowid as number,
                scheduled_date: date,
                garbage_type: type,
                description,
                created_at: now
            };
        } catch (error) {
            logger.error(`Failed to add garbage schedule entry: ${error}`);
            throw error;
        }
    }

    remove(id: number): boolean {
        try {
            const stmt = this.db.prepare('DELETE FROM garbage_schedule WHERE id = ?');
            const result = stmt.run(id);
            return result.changes > 0;
        } catch (error) {
            logger.error(`Failed to remove garbage schedule entry: ${error}`);
            return false;
        }
    }
}

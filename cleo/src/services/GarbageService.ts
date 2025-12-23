import { Database } from 'better-sqlite3';
import { getDatabase } from '../database/db';
import { logger } from '../utils/logger';
import * as nodeIcal from 'node-ical';

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

    async syncFromCalendar(url: string): Promise<void> {
        if (!url) {
            logger.warn('Garbage calendar URL not configured, skipping sync');
            return;
        }

        logger.info(`Syncing garbage calendar from ${url}`);

        try {
            // Check if URL is webcal and replace with https if needed,
            // though node-ical might handle it, it's safer to ensure http(s)
            const syncUrl = url.replace('webcal://', 'https://');

            const events = await nodeIcal.async.fromURL(syncUrl);
            const validEvents: Array<{ date: string; type: string; description?: string }> = [];

            for (const eventId in events) {
                if (Object.prototype.hasOwnProperty.call(events, eventId)) {
                    const event = events[eventId];
                    if (event.type === 'VEVENT' && event.start) {
                        const date = event.start.toISOString().split('T')[0];
                        const summary = event.summary?.trim();

                        if (summary) {
                            validEvents.push({
                                date,
                                type: summary,
                                description: event.description
                            });
                        }
                    }
                }
            }

            if (validEvents.length === 0) {
                logger.warn('No events found in garbage calendar');
                return;
            }

            logger.info(`Found ${validEvents.length} events in garbage calendar. Updating database...`);

            const insertStmt = this.db.prepare(`
                INSERT INTO garbage_schedule (scheduled_date, garbage_type, description, created_at)
                VALUES (?, ?, ?, ?)
            `);



            const deleteFutureStmt = this.db.prepare(`
                DELETE FROM garbage_schedule WHERE scheduled_date >= ?
            `);

            // Transaction to ensure data integrity
            const transaction = this.db.transaction(() => {
                // Option 1: Upsert individually (preserves past history if we don't wipe everything)
                // Option 2: Wipe future events and replace with new calendar data (cleaner for schedule changes)
                // Going with Option 2: Wipe everything from today onwards and re-insert

                const today = new Date().toISOString().split('T')[0];
                deleteFutureStmt.run(today);

                const now = Date.now();
                let addedCount = 0;

                for (const event of validEvents) {
                    // Only add valid future or today events (or all if we want history, but usually user cares about upcoming)
                    // If the calendar feed contains history, we might duplicate if we blindly insert.
                    // But since we wiped >= today, we should only insert >= today from the feed to be safe.
                    // If the user wants history, we'd need a smarter merge strategy. 
                    // For now, let's assume we want to sync the *full* calendar as provided, 
                    // but avoid duplicates if we didn't wipe past events.

                    // Let's filter for >= today for the insert to match the wipe
                    if (event.date >= today) {
                        insertStmt.run(event.date, event.type, event.description || null, now);
                        addedCount++;
                    }
                }
                return addedCount;
            });

            const count = transaction();
            logger.info(`Successfully synced ${count} garbage collection events`);

        } catch (error) {
            logger.error(`Failed to sync garbage calendar: ${error}`);
            throw error;
        }
    }
}

import { getDatabase } from '../database/db';
import { Chore, CreateChoreInput, UpdateChoreInput, ChoreWithStatus } from '../models/Chore';
import { ChoreHistory, CreateChoreHistoryInput } from '../models/ChoreHistory';
import { logger } from '../utils/logger';

export class ChoreService {
  getAllChores(): Chore[] {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM chores
      WHERE active = 1
      ORDER BY priority DESC, name ASC
    `);
    return stmt.all() as Chore[];
  }

  getChoreById(id: number): Chore | null {
    const db = getDatabase();
    const stmt = db.prepare(`SELECT * FROM chores WHERE id = ?`);
    const chore = stmt.get(id) as Chore | undefined;
    return chore || null;
  }

  getChoreByName(name: string): Chore | null {
    const db = getDatabase();
    const stmt = db.prepare(`SELECT * FROM chores WHERE name = ? AND active = 1`);
    const chore = stmt.get(name) as Chore | undefined;
    return chore || null;
  }

  createChore(input: CreateChoreInput): Chore {
    const db = getDatabase();
    const now = Date.now();

    const stmt = db.prepare(`
      INSERT INTO chores (name, description, frequency_hours, priority, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, 1, ?, ?)
    `);

    const result = stmt.run(
      input.name,
      input.description || null,
      input.frequency_hours,
      input.priority || 1,
      now,
      now
    );

    logger.info(`Created chore: ${input.name} (ID: ${result.lastInsertRowid})`);

    const newChore = this.getChoreById(result.lastInsertRowid as number);
    if (!newChore) {
      throw new Error('Failed to retrieve newly created chore');
    }
    return newChore;
  }

  updateChore(id: number, input: UpdateChoreInput): Chore {
    const chore = this.getChoreById(id);
    if (!chore) {
      throw new Error(`Chore with ID ${id} not found`);
    }

    const db = getDatabase();
    const updates: string[] = [];
    const values: any[] = [];

    if (input.name !== undefined) {
      updates.push('name = ?');
      values.push(input.name);
    }
    if (input.description !== undefined) {
      updates.push('description = ?');
      values.push(input.description);
    }
    if (input.frequency_hours !== undefined) {
      updates.push('frequency_hours = ?');
      values.push(input.frequency_hours);
    }
    if (input.priority !== undefined) {
      updates.push('priority = ?');
      values.push(input.priority);
    }
    if (input.active !== undefined) {
      updates.push('active = ?');
      values.push(input.active ? 1 : 0);
    }

    updates.push('updated_at = ?');
    values.push(Date.now());
    values.push(id);

    const stmt = db.prepare(`UPDATE chores SET ${updates.join(', ')} WHERE id = ?`);
    stmt.run(...values);

    logger.info(`Updated chore: ${chore.name} (ID: ${id})`);

    const updatedChore = this.getChoreById(id);
    if (!updatedChore) {
      throw new Error('Failed to retrieve updated chore');
    }
    return updatedChore;
  }

  deleteChore(id: number): void {
    const chore = this.getChoreById(id);
    if (!chore) {
      throw new Error(`Chore with ID ${id} not found`);
    }

    const db = getDatabase();
    const stmt = db.prepare(`UPDATE chores SET active = 0, updated_at = ? WHERE id = ?`);
    stmt.run(Date.now(), id);

    logger.info(`Deleted chore: ${chore.name} (ID: ${id})`);
  }

  markChoreComplete(input: CreateChoreHistoryInput): ChoreHistory {
    const chore = this.getChoreById(input.chore_id);
    if (!chore) {
      throw new Error(`Chore with ID ${input.chore_id} not found`);
    }

    const db = getDatabase();
    const now = Date.now();

    const stmt = db.prepare(`
      INSERT INTO chore_history (chore_id, completed_at, completed_by, notes)
      VALUES (?, ?, ?, ?)
    `);

    const result = stmt.run(
      input.chore_id,
      now,
      input.completed_by || null,
      input.notes || null
    );

    logger.info(
      `Marked chore complete: ${chore.name} (ID: ${input.chore_id}) by ${input.completed_by || 'unknown'}`
    );

    return {
      id: result.lastInsertRowid as number,
      chore_id: input.chore_id,
      completed_at: now,
      completed_by: input.completed_by || null,
      notes: input.notes || null,
    };
  }

  getLastCompletion(choreId: number): ChoreHistory | null {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM chore_history
      WHERE chore_id = ?
      ORDER BY completed_at DESC
      LIMIT 1
    `);
    const history = stmt.get(choreId) as ChoreHistory | undefined;
    return history || null;
  }

  getChoreHistory(choreId: number, limit = 10): ChoreHistory[] {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM chore_history
      WHERE chore_id = ?
      ORDER BY completed_at DESC
      LIMIT ?
    `);
    return stmt.all(choreId, limit) as ChoreHistory[];
  }

  getAllChoresWithStatus(): ChoreWithStatus[] {
    const chores = this.getAllChores();
    return chores.map((chore) => this.addStatusToChore(chore));
  }

  getOverdueChores(): ChoreWithStatus[] {
    const choresWithStatus = this.getAllChoresWithStatus();
    return choresWithStatus.filter((chore) => chore.is_overdue);
  }

  getChoreStats(choreId: number): Array<{ user: string; count: number }> {
    console.log('Getting stats for chore ID:', choreId);
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT completed_by as user, COUNT(*) as count 
      FROM chore_history 
      WHERE chore_id = ? 
      AND completed_by IS NOT NULL
      GROUP BY completed_by
      ORDER BY count DESC
    `);

    // Also include 'Unknown' if there are completions with null completed_by
    const unknownStmt = db.prepare(`
        SELECT COUNT(*) as count
        FROM chore_history
        WHERE chore_id = ?
        AND completed_by IS NULL
    `);

    const stats = stmt.all(choreId) as Array<{ user: string; count: number }>;
    const unknownResult = unknownStmt.get(choreId) as { count: number } | undefined;
    const unknownCount = unknownResult ? unknownResult.count : 0;

    if (unknownCount > 0) {
      stats.push({ user: 'Unknown', count: unknownCount });
    }

    return stats;
  }

  private addStatusToChore(chore: Chore): ChoreWithStatus {
    const lastCompletion = this.getLastCompletion(chore.id);
    const dueDate = this.calculateDueDate(chore, lastCompletion);
    const now = Date.now();

    const daysUntilDue = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));

    return {
      ...chore,
      last_completed: lastCompletion?.completed_at,
      last_completed_by: lastCompletion?.completed_by,
      due_date: dueDate,
      is_overdue: now >= dueDate,
      days_until_due: daysUntilDue,
    };
  }

  private calculateDueDate(chore: Chore, lastCompletion: ChoreHistory | null): number {
    const baseTime = lastCompletion ? lastCompletion.completed_at : chore.created_at;
    const frequencyMs = chore.frequency_hours * 60 * 60 * 1000;
    return baseTime + frequencyMs;
  }
}

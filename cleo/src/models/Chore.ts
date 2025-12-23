export interface Chore {
  id: number;
  name: string;
  description: string | null;
  frequency_hours: number;
  priority: number;
  active: number; // 0 or 1 (SQLite doesn't have boolean)
  created_at: number; // Unix timestamp in milliseconds
  updated_at: number; // Unix timestamp in milliseconds
}

export interface CreateChoreInput {
  name: string;
  description?: string;
  frequency_hours: number;
  priority?: number;
}

export interface UpdateChoreInput {
  name?: string;
  description?: string;
  frequency_hours?: number;
  priority?: number;
  active?: boolean;
}

export interface ChoreWithStatus extends Chore {
  last_completed?: number; // Unix timestamp in milliseconds
  due_date: number; // Unix timestamp in milliseconds
  is_overdue: boolean;
  days_until_due: number; // Can be negative if overdue
}

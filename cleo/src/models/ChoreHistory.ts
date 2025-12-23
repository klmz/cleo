export interface ChoreHistory {
  id: number;
  chore_id: number;
  completed_at: number; // Unix timestamp in milliseconds
  completed_by: string | null;
  notes: string | null;
}

export interface CreateChoreHistoryInput {
  chore_id: number;
  completed_by?: string;
  notes?: string;
}

export interface ChoreHistoryWithChore extends ChoreHistory {
  chore_name: string;
  chore_description: string | null;
}

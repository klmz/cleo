export interface ChatMessage {
  id: number;
  chat_id: number;
  message_id: number;
  user_id: number | null;
  username: string | null;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number; // Unix timestamp in milliseconds
  model_used: string | null;
}

export interface CreateChatMessageInput {
  chat_id: number;
  message_id: number;
  user_id?: number;
  username?: string;
  role: 'user' | 'assistant';
  content: string;
  model_used?: string;
}

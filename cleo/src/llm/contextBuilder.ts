import { ChatMessage } from '../models/ChatMessage';
import { getDatabase } from '../database/db';

export function getRecentChatHistory(chatId: number, limit = 10): ChatMessage[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM chat_messages
    WHERE chat_id = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `);

  const messages = stmt.all(chatId, limit) as ChatMessage[];
  return messages.reverse();
}

export function storeChatMessage(
  chatId: number,
  messageId: number,
  role: 'user' | 'assistant',
  content: string,
  userId?: number,
  username?: string,
  modelUsed?: string
): void {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO chat_messages (chat_id, message_id, user_id, username, role, content, timestamp, model_used)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    chatId,
    messageId,
    userId || null,
    username || null,
    role,
    content,
    Date.now(),
    modelUsed || null
  );
}

export interface GeminiMessage {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

export function formatMessagesForGemini(messages: ChatMessage[]): GeminiMessage[] {
  let formattedMessages = messages.map((msg) => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  })) as GeminiMessage[];

  // Gemini requires the first message in history to be from 'user'.
  // If the history slice starts with 'model', remove it.
  while (formattedMessages.length > 0 && formattedMessages[0].role === 'model') {
    formattedMessages.shift();
  }

  return formattedMessages;
}

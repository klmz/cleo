import { ChatMessage } from '../models/ChatMessage';

export type ModelComplexity = 'simple' | 'complex';

const SIMPLE_KEYWORDS = [
  'list',
  'status',
  'done',
  'complete',
  'finished',
  'when',
  'what',
  'show',
  'display',
];

const COMPLEX_KEYWORDS = [
  'think'
];

export function classifyComplexity(message: string, history: ChatMessage[]): ModelComplexity {
  const messageLower = message.toLowerCase();

  if (messageLower.length > 700) {
    return 'complex';
  }

  const hasComplexKeyword = COMPLEX_KEYWORDS.some((keyword) => messageLower.includes(keyword));
  if (hasComplexKeyword) {
    return 'complex';
  }

  const hasSimpleKeyword = SIMPLE_KEYWORDS.some((keyword) => messageLower.includes(keyword));
  if (hasSimpleKeyword && message.length < 50) {
    return 'simple';
  }

  if (history.length > 5) {
    const recentMessages = history.slice(-5);
    const hasDeepConversation = recentMessages.some(
      (msg) => msg.role === 'assistant' && msg.content.length > 150
    );
    if (hasDeepConversation) {
      return 'simple';
    }
  }

  return 'simple';
}

export function getModelName(complexity: ModelComplexity): string {
  switch (complexity) {
    case 'simple':
      return 'gemini-3-flash-preview';
    case 'complex':
      return 'gemini-3-pro-preview';
    default:
      return 'gemini-3-flash-preview';
  }
}

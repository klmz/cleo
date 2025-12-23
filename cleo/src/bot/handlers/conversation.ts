import { Context } from 'telegraf';
import { message } from 'telegraf/filters';
import { ChoreService } from '../../services/ChoreService';
import { GeminiService } from '../../services/GeminiService';
import { getRecentChatHistory, storeChatMessage } from '../../llm/contextBuilder';
import { logger } from '../../utils/logger';

interface ActionMatch {
  type: 'MARK_COMPLETE';
  choreName: string;
}

function parseActions(response: string): ActionMatch[] {
  const actions: ActionMatch[] = [];
  const actionRegex = /\[ACTION:MARK_COMPLETE:([^\]]+)\]/g;
  let match;

  while ((match = actionRegex.exec(response)) !== null) {
    actions.push({
      type: 'MARK_COMPLETE',
      choreName: match[1].trim(),
    });
  }

  return actions;
}

function stripActions(response: string): string {
  return response.replace(/\[ACTION:[^\]]+\]/g, '').trim();
}

export function createConversationHandler(
  choreService: ChoreService,
  geminiService: GeminiService
) {
  return async (ctx: Context): Promise<void> => {
    if (!ctx.message || !('text' in ctx.message)) {
      return;
    }

    const chatId = ctx.chat.id;
    const messageText = ctx.message.text;
    const userId = ctx.from?.id;
    const username = ctx.from?.username || ctx.from?.first_name || 'unknown';

    logger.info(`Conversation message from ${username}: "${messageText}"`);

    storeChatMessage(chatId, ctx.message.message_id, 'user', messageText, userId, username);

    try {
      const history = getRecentChatHistory(chatId, 10);
      const chores = choreService.getAllChoresWithStatus();

      const { response, modelUsed } = await geminiService.chat(
        messageText,
        history,
        chores
      );

      const actions = parseActions(response);
      const cleanResponse = stripActions(response);

      if (actions.length > 0) {
        for (const action of actions) {
          try {
            const chore = choreService.getChoreByName(action.choreName.toLowerCase());
            if (chore) {
              choreService.markChoreComplete({
                chore_id: chore.id,
                completed_by: username,
              });
              logger.info(`Action executed: marked ${chore.name} as complete`);
            } else {
              logger.warn(`Action failed: chore "${action.choreName}" not found`);
            }
          } catch (error) {
            logger.error(`Error executing action: ${error}`);
          }
        }
      }

      const replyMessage = await ctx.reply(cleanResponse, { parse_mode: 'Markdown' });

      storeChatMessage(
        chatId,
        replyMessage.message_id,
        'assistant',
        cleanResponse,
        undefined,
        undefined,
        modelUsed
      );

      logger.info(`Response sent using ${modelUsed}`);
    } catch (error) {
      logger.error(`Error in conversation handler: ${error}`);
      await ctx.reply(
        'Sorry, I encountered an error processing your message. Please try again or use a specific command like /list or /done.'
      );
    }
  };
}

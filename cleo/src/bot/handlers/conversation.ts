import { Context } from 'telegraf';
import { ChoreService } from '../../services/ChoreService';
import { GeminiService } from '../../services/GeminiService';
import { HomeAssistantService } from '../../services/HomeAssistantService';
import { getRecentChatHistory, storeChatMessage } from '../../llm/contextBuilder';
import { logger } from '../../utils/logger';

interface ActionMatch {
  type: 'MARK_COMPLETE' | 'DEVICE_ON' | 'DEVICE_OFF';
  target: string; // choreName or entityId
}

function parseActions(response: string): ActionMatch[] {
  const actions: ActionMatch[] = [];

  // Mark complete
  const markRegex = /\[ACTION:MARK_COMPLETE:([^\]]+)\]/g;
  let match;
  while ((match = markRegex.exec(response)) !== null) {
    actions.push({ type: 'MARK_COMPLETE', target: match[1].trim() });
  }

  // Device On
  const onRegex = /\[ACTION:DEVICE:TURN_ON:([^\]]+)\]/g;
  while ((match = onRegex.exec(response)) !== null) {
    actions.push({ type: 'DEVICE_ON', target: match[1].trim() });
  }

  // Device Off
  const offRegex = /\[ACTION:DEVICE:TURN_OFF:([^\]]+)\]/g;
  while ((match = offRegex.exec(response)) !== null) {
    actions.push({ type: 'DEVICE_OFF', target: match[1].trim() });
  }

  return actions;
}

function stripActions(response: string): string {
  return response.replace(/\[ACTION:[^\]]+\]/g, '').trim();
}

export function createConversationHandler(
  choreService: ChoreService,
  geminiService: GeminiService,
  homeAssistantService?: HomeAssistantService
) {
  return async (ctx: Context): Promise<void> => {
    if (!ctx.message || !('text' in ctx.message)) {
      return;
    }

    if (!ctx.chat || !ctx.from) {
      logger.error('No chat or user found');
      return;
    }
    const chatId = ctx.chat.id;
    const messageText = ctx.message.text;
    const userId = ctx.from?.id;
    const username = ctx.from?.username || ctx.from?.first_name || 'unknown';

    logger.info(`Conversation message from ${username}: "${messageText}"`);

    storeChatMessage(chatId, ctx.message.message_id, 'user', messageText, userId, username);

    await ctx.sendChatAction('typing');



    try {
      const history = getRecentChatHistory(chatId, 10);
      const chores = choreService.getAllChoresWithStatus();

      // Heuristic: Check if we should fetch HA context
      const haKeywords = ['home', 'who', 'where', 'light', 'lamp', 'turn', 'switch', 'sensor', 'status', 'temp', 'humidity', 'door', 'lock', 'window', 'kitchen', 'living', 'bed'];
      const shouldFetchContext = haKeywords.some(keyword => messageText.toLowerCase().includes(keyword));

      let devices: any[] = []; // Use 'any' or proper type from prompts/service
      if (shouldFetchContext && homeAssistantService) {
        try {
          logger.debug('Fetching HA context based on keyword match');
          devices = await homeAssistantService.getRelevantEntities();
        } catch (err) {
          logger.error(`Failed to fetch HA context: ${err}`);
        }
      }

      // We need to update geminiService.chat signature or just pass it in options if we refactor.
      // But looking at GeminiService.chat, it DOES NOT accept devices yet in the parameters 
      // except via our previous manual update plan which said we'd update it. 
      // Wait, I previously updated GeminiService to call buildSystemPrompt(chores), 
      // but I need to pass 'devices' to 'chat' so 'chat' can pass it to 'buildSystemPrompt'.

      const { response, modelUsed } = await geminiService.chat(
        messageText,
        history,
        chores,
        undefined, // complexity
        devices
      );

      const actions = parseActions(response);
      const cleanResponse = stripActions(response);

      if (actions.length > 0) {
        for (const action of actions) {
          try {
            if (action.type === 'MARK_COMPLETE') {
              const chore = choreService.getChoreByName(action.target.toLowerCase());
              if (chore) {
                choreService.markChoreComplete({
                  chore_id: chore.id,
                  completed_by: username,
                });
                logger.info(`Action executed: marked ${chore.name} as complete`);
              } else {
                logger.warn(`Action failed: chore "${action.target}" not found`);
              }
            } else if (action.type === 'DEVICE_ON' || action.type === 'DEVICE_OFF') {
              if (homeAssistantService) {
                const service = action.type === 'DEVICE_ON' ? 'turn_on' : 'turn_off';
                const entityId = action.target;
                // Basic validation that it looks like an entity ID
                if (entityId.includes('.')) {
                  await homeAssistantService.callService('light', service, { entity_id: entityId }); // assume light domain for now or infer from entity_id?
                  // Actually better to use generic "homeassistant" domain or split the entity_id
                  // But turn_on/turn_off is common. Let's try to be smart.
                  const domain = entityId.split('.')[0];
                  if (domain === 'light' || domain === 'switch') {
                    // Re-call with correct domain if we want to be specific, or just use `homeassistant.turn_on`
                    await homeAssistantService.callService(domain, service, { entity_id: entityId });
                    logger.info(`Action executed: ${service} ${entityId}`);
                  } else {
                    logger.warn(`Action skipped: unsupported domain for ${entityId}`);
                  }
                } else {
                  logger.warn(`Action failed: invalid entity ID ${entityId}`);
                }
              } else {
                logger.warn('Action failed: Home Assistant not configured');
              }
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

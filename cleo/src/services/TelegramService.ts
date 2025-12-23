import { Telegraf, Context } from 'telegraf';
import { message } from 'telegraf/filters';
import { AddonOptions, getAllowedChatIds } from '../config/options';
import { ChoreService } from './ChoreService';
import { GeminiService } from './GeminiService';
import { HomeAssistantService } from './HomeAssistantService';
import { createSecurityMiddleware } from '../bot/middleware/security';
import { loggingMiddleware } from '../bot/middleware/logging';
import { errorHandler } from '../bot/middleware/error';
import { startCommand } from '../bot/commands/start';
import { createListCommand } from '../bot/commands/list';
import { createDoneCommand } from '../bot/commands/done';
import { createAddCommand } from '../bot/commands/add';
import { createRemoveCommand } from '../bot/commands/remove';
import { createConversationHandler } from '../bot/handlers/conversation';
import { logger } from '../utils/logger';

export class TelegramService {
  private bot: Telegraf<Context>;
  private choreService: ChoreService;
  private geminiService: GeminiService;
  private homeAssistantService?: HomeAssistantService;

  constructor(
    options: AddonOptions,
    choreService: ChoreService,
    geminiService: GeminiService,
    homeAssistantService?: HomeAssistantService
  ) {
    this.bot = new Telegraf(options.telegram_token);
    this.choreService = choreService;
    this.geminiService = geminiService;
    this.homeAssistantService = homeAssistantService;

    this.setupMiddleware(options);
    this.setupHandlers();
    this.setupErrorHandling();
  }

  private setupMiddleware(options: AddonOptions): void {
    const allowedChatIds = getAllowedChatIds(options);
    this.bot.use(loggingMiddleware);
    this.bot.use(createSecurityMiddleware(allowedChatIds));
  }

  private setupHandlers(): void {
    logger.info('Setting up bot command handlers');

    this.bot.command('start', startCommand);
    this.bot.command('list', createListCommand(this.choreService));
    this.bot.command('done', createDoneCommand(this.choreService));
    this.bot.command('add', createAddCommand(this.choreService));
    this.bot.command('remove', createRemoveCommand(this.choreService));

    this.bot.on(message('text'), createConversationHandler(this.choreService, this.geminiService, this.homeAssistantService));

    this.bot.on('callback_query', async (ctx) => {
      try {
        const query = ctx.callbackQuery;
        if (!('data' in query)) return;

        const data = query.data;
        if (!data) return;

        if (data.startsWith('DEVICE:TURN_OF:')) {
          const entityId = data.substring('DEVICE:TURN_OF:'.length);
          if (this.homeAssistantService) {
            await this.homeAssistantService.callService('light', 'turn_off', { entity_id: entityId });
            await ctx.answerCbQuery(`Turning off ${entityId}`);
            await ctx.editMessageText(`✅ Turned off ${entityId}`, { parse_mode: 'Markdown' });
          } else {
            await ctx.answerCbQuery('Home Assistant integration not configured');
          }
        }
      } catch (error) {
        logger.error(`Error handling callback query: ${error}`);
      }
    });

    logger.info('Bot command handlers and conversation handler registered successfully');
  }

  private setupErrorHandling(): void {
    this.bot.catch(errorHandler);
  }

  async start(): Promise<void> {
    logger.info('Starting Telegram bot');
    await this.bot.launch();
    logger.info('Telegram bot started successfully');
  }

  async stop(): Promise<void> {
    logger.info('Stopping Telegram bot');
    this.bot.stop();
    logger.info('Telegram bot stopped');
  }

  getBotInstance(): Telegraf<Context> {
    return this.bot;
  }

  async sendMessage(chatId: number, text: string, deviceActions: string[] = []): Promise<void> {
    try {
      const extra: any = { parse_mode: 'Markdown' };

      if (deviceActions.length > 0) {
        // Assume deviceAction is entity_id for simple "Turn Off" button
        extra.reply_markup = {
          inline_keyboard: deviceActions.map(entityId => ([
            { text: `Turn Off ${entityId.split('.')[1]}`, callback_data: `DEVICE:TURN_OF:${entityId}` }
          ]))
        };
      }

      await this.bot.telegram.sendMessage(chatId, text, extra);
    } catch (error) {
      logger.error(`Failed to send message to chat ${chatId}: ${error}`);
      throw error;
    }
  }
}

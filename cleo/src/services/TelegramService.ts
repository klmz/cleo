import { Telegraf, Context } from 'telegraf';
import { message } from 'telegraf/filters';
import { AddonOptions, getAllowedChatIds } from '../config/options';
import { ChoreService } from './ChoreService';
import { GeminiService } from './GeminiService';
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

  constructor(
    options: AddonOptions,
    choreService: ChoreService,
    geminiService: GeminiService
  ) {
    this.bot = new Telegraf(options.telegram_token);
    this.choreService = choreService;
    this.geminiService = geminiService;

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

    this.bot.on(message('text'), createConversationHandler(this.choreService, this.geminiService));

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

  async sendMessage(chatId: number, text: string): Promise<void> {
    try {
      await this.bot.telegram.sendMessage(chatId, text, { parse_mode: 'Markdown' });
    } catch (error) {
      logger.error(`Failed to send message to chat ${chatId}: ${error}`);
      throw error;
    }
  }
}

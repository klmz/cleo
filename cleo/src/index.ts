import { loadOptions, getAllowedChatIds } from './config/options';
import { initializeDatabase, closeDatabase } from './database/db';
import { ChoreService } from './services/ChoreService';
import { GeminiService } from './services/GeminiService';
import { TelegramService } from './services/TelegramService';
import { ReminderService } from './services/ReminderService';
import { logger } from './utils/logger';

async function main() {
  logger.info('Starting Cleo Household Manager');

  try {
    const options = loadOptions();

    process.env.LOG_LEVEL = options.log_level;
    logger.level = options.log_level;

    const dbPath = process.env.DB_PATH || '/data/cleo.db';
    logger.info(`Database path: ${dbPath}`);

    initializeDatabase(dbPath);

    const choreService = new ChoreService();
    const geminiService = new GeminiService(options.gemini_api_key);
    const telegramService = new TelegramService(options, choreService, geminiService);

    const allowedChatIds = getAllowedChatIds(options);
    const reminderService = new ReminderService(
      choreService,
      telegramService,
      options.reminder_check_interval,
      allowedChatIds
    );

    await telegramService.start();
    reminderService.start();

    logger.info('Cleo Household Manager started successfully');

    process.once('SIGINT', () => gracefulShutdown(telegramService, reminderService));
    process.once('SIGTERM', () => gracefulShutdown(telegramService, reminderService));
  } catch (error) {
    logger.error(`Failed to start application: ${error}`);
    process.exit(1);
  }
}

async function gracefulShutdown(
  telegramService: TelegramService,
  reminderService: ReminderService
) {
  logger.info('Shutting down gracefully...');

  try {
    reminderService.stop();
    await telegramService.stop();
    closeDatabase();

    logger.info('Shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error(`Error during shutdown: ${error}`);
    process.exit(1);
  }
}

main().catch((error) => {
  logger.error(`Unhandled error in main: ${error}`);
  process.exit(1);
});

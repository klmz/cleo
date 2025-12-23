import 'dotenv/config';

import { initializeDatabase, closeDatabase } from './database/db';
import { ChoreService } from './services/ChoreService';
import { GeminiService } from './services/GeminiService';
import { TelegramService } from './services/TelegramService';
import { HomeAssistantService } from './services/HomeAssistantService';
import { ReminderService } from './services/ReminderService';
import { GarbageService } from './services/GarbageService';
import { WebServer } from './services/WebServer';
import { logger } from './utils/logger';
import { getKidsRoomEntities, loadOptions, getAllowedChatIds } from './config/options';

async function main() {
  logger.info('Starting Cleo Household Manager');

  try {
    const options = loadOptions();

    process.env.LOG_LEVEL = options.log_level;
    logger.level = options.log_level;

    const dbPath = process.env.DB_PATH || '/data/cleo.db';
    logger.info(`Database path: ${dbPath}`);

    initializeDatabase(dbPath);

    let homeAssistantService: HomeAssistantService | undefined;

    if (options.homeassistant_url && options.homeassistant_token) {
      logger.info('Initializing Home Assistant service');
      homeAssistantService = new HomeAssistantService(
        options.homeassistant_url,
        options.homeassistant_token
      );
    } else {
      logger.info('Home Assistant integration disabled (configuration missing)');
    }

    const choreService = new ChoreService();
    const garbageService = new GarbageService();
    const geminiService = new GeminiService(options.gemini_api_key);
    const telegramService = new TelegramService(options, choreService, geminiService, homeAssistantService);
    const webServer = new WebServer(choreService, garbageService);

    const allowedChatIds = getAllowedChatIds(options);
    const kidsRoomEntities = getKidsRoomEntities(options);

    const reminderService = new ReminderService(
      choreService,
      telegramService,
      options.reminder_check_interval,
      allowedChatIds,
      homeAssistantService,
      kidsRoomEntities
    );

    await telegramService.start();
    reminderService.start();
    webServer.start();

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

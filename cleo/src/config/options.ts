import * as fs from 'fs';
import { logger } from '../utils/logger';

export interface AddonOptions {
  telegram_token: string;
  gemini_api_key: string;
  allowed_chat_ids: string;
  garbage_calendar_url?: string;
  homeassistant_url?: string;
  homeassistant_token?: string;
  kids_room_entities?: string;
  reminder_check_interval: number;
  log_level: 'debug' | 'info' | 'warn' | 'error';
}

const DEFAULT_OPTIONS: Partial<AddonOptions> = {
  reminder_check_interval: 60,
  log_level: 'info',
};

// Helper to auto-discover HA if running as an addon
function applyAutoDiscovery(options: AddonOptions): AddonOptions {
  // If no URL/Token configured, try Supervisor defaults
  if (!options.homeassistant_url && !options.homeassistant_token && process.env.SUPERVISOR_TOKEN) {
    logger.info('Auto-discovering Home Assistant configuration from Supervisor environment');
    options.homeassistant_url = 'http://supervisor/core';
    options.homeassistant_token = process.env.SUPERVISOR_TOKEN;
  }
  return options;
}

export function loadOptions(): AddonOptions {
  const optionsPath = process.env.OPTIONS_PATH || '/data/options.json';

  logger.debug(`Loading configuration from ${optionsPath}`);

  if (!fs.existsSync(optionsPath)) {
    logger.warn(`Options file not found at ${optionsPath}, attempting to load from environment variables`);
    return loadOptionsFromEnv();
  }

  const fileContents = fs.readFileSync(optionsPath, 'utf-8');
  const options = JSON.parse(fileContents) as Partial<AddonOptions>;

  const mergedOptions: AddonOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
  } as AddonOptions;

  const finalOptions = applyAutoDiscovery(mergedOptions);

  validateOptions(finalOptions);

  logger.info('Configuration loaded successfully');
  logger.debug(`Reminder check interval: ${finalOptions.reminder_check_interval} minutes`);
  logger.debug(`Log level: ${finalOptions.log_level}`);
  logger.debug(
    `Allowed chat IDs: ${finalOptions.allowed_chat_ids ? 'configured' : 'not configured'}`
  );

  return finalOptions;
}

function validateOptions(options: AddonOptions): void {
  const errors: string[] = [];

  if (!options.telegram_token) {
    errors.push('telegram_token is required');
  }

  if (!options.gemini_api_key) {
    errors.push('gemini_api_key is required');
  }

  if (!options.allowed_chat_ids) {
    errors.push('allowed_chat_ids is required');
  }

  if (options.reminder_check_interval < 5 || options.reminder_check_interval > 1440) {
    errors.push('reminder_check_interval must be between 5 and 1440 minutes');
  }

  if (!['debug', 'info', 'warn', 'error'].includes(options.log_level)) {
    errors.push('log_level must be one of: debug, info, warn, error');
  }

  // Optional Home Assistant configuration check
  if (options.homeassistant_url && !options.homeassistant_token) {
    errors.push('homeassistant_token is required when homeassistant_url is provided');
  }
  if (!options.homeassistant_url && options.homeassistant_token) {
    errors.push('homeassistant_url is required when homeassistant_token is provided');
  }

  if (errors.length > 0) {
    logger.error('Configuration validation failed:');
    errors.forEach((error) => logger.error(`  - ${error}`));
    throw new Error(`Invalid configuration: ${errors.join(', ')}`);
  }
}

export function getAllowedChatIds(options: AddonOptions): number[] {
  return options.allowed_chat_ids
    .split(',')
    .map((id) => parseInt(id.trim(), 10))
    .filter((id) => !isNaN(id));
}

export function getKidsRoomEntities(options: AddonOptions): string[] {
  if (!options.kids_room_entities) {
    return [];
  }
  return options.kids_room_entities
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
}

function loadOptionsFromEnv(): AddonOptions {
  const options: Partial<AddonOptions> = {
    telegram_token: process.env.TELEGRAM_TOKEN,
    gemini_api_key: process.env.GEMINI_API_KEY,
    allowed_chat_ids: process.env.ALLOWED_CHAT_IDS,
    garbage_calendar_url: process.env.GARBAGE_CALENDAR_URL,
    homeassistant_url: process.env.HOMEASSISTANT_URL,
    homeassistant_token: process.env.HOMEASSISTANT_TOKEN,
    kids_room_entities: process.env.KIDS_ROOM_ENTITIES,
    reminder_check_interval: process.env.REMINDER_CHECK_INTERVAL
      ? parseInt(process.env.REMINDER_CHECK_INTERVAL, 10)
      : undefined,
    log_level: process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error',
  };

  const mergedOptions: AddonOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
  } as AddonOptions;

  const finalOptions = applyAutoDiscovery(mergedOptions);

  validateOptions(finalOptions);

  logger.info('Configuration loaded from environment variables');
  logger.debug(`Reminder check interval: ${finalOptions.reminder_check_interval} minutes`);
  logger.debug(`Log level: ${finalOptions.log_level}`);
  logger.debug(
    `Allowed chat IDs: ${finalOptions.allowed_chat_ids ? 'configured' : 'not configured'}`
  );

  return finalOptions;
}

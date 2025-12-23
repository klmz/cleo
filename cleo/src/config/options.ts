import * as fs from 'fs';
import { logger } from '../utils/logger';

export interface AddonOptions {
  telegram_token: string;
  gemini_api_key: string;
  allowed_chat_ids: string;
  homeassistant_url?: string;
  homeassistant_token?: string;
  reminder_check_interval: number;
  log_level: 'debug' | 'info' | 'warn' | 'error';
}

const DEFAULT_OPTIONS: Partial<AddonOptions> = {
  reminder_check_interval: 60,
  log_level: 'info',
};

export function loadOptions(): AddonOptions {
  const optionsPath = process.env.OPTIONS_PATH || '/data/options.json';

  logger.debug(`Loading configuration from ${optionsPath}`);

  if (!fs.existsSync(optionsPath)) {
    logger.error(`Options file not found at ${optionsPath}`);
    throw new Error(`Options file not found: ${optionsPath}`);
  }

  const fileContents = fs.readFileSync(optionsPath, 'utf-8');
  const options = JSON.parse(fileContents) as Partial<AddonOptions>;

  const mergedOptions: AddonOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
  } as AddonOptions;

  validateOptions(mergedOptions);

  logger.info('Configuration loaded successfully');
  logger.debug(`Reminder check interval: ${mergedOptions.reminder_check_interval} minutes`);
  logger.debug(`Log level: ${mergedOptions.log_level}`);
  logger.debug(
    `Allowed chat IDs: ${mergedOptions.allowed_chat_ids ? 'configured' : 'not configured'}`
  );

  return mergedOptions;
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

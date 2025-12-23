import { Context } from 'telegraf';
import { logger } from '../../utils/logger';
import { MaybePromise } from 'telegraf/typings/core/helpers/util';

export function errorHandler(e: unknown, ctx: Context): MaybePromise<void> {
  let error = e as Error;
  logger.error(`Telegram bot error: ${error.message}`, { stack: error.stack });

  try {
    ctx.reply(
      'Sorry, something went wrong while processing your request. Please try again later.'
    ).then;
  } catch (replyError) {
    logger.error(`Failed to send error message to user: ${replyError}`);
  }
}

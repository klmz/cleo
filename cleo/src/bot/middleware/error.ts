import { Context } from 'telegraf';
import { logger } from '../../utils/logger';

export async function errorHandler(error: Error, ctx: Context): Promise<void> {
  logger.error(`Telegram bot error: ${error.message}`, { stack: error.stack });

  try {
    await ctx.reply(
      'Sorry, something went wrong while processing your request. Please try again later.'
    );
  } catch (replyError) {
    logger.error(`Failed to send error message to user: ${replyError}`);
  }
}

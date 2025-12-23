import { Context, MiddlewareFn } from 'telegraf';
import { logger } from '../../utils/logger';

export const loggingMiddleware: MiddlewareFn<Context> = async (ctx, next) => {
  const start = Date.now();
  const updateType = ctx.updateType;
  const chatId = ctx.chat?.id;
  const userId = ctx.from?.id;
  const username = ctx.from?.username;

  logger.debug(
    `Incoming ${updateType} from chat ${chatId}, user ${userId} (${username || 'no username'})`
  );

  try {
    await next();
    const duration = Date.now() - start;
    logger.debug(`Processed ${updateType} in ${duration}ms`);
  } catch (error) {
    const duration = Date.now() - start;
    logger.error(
      `Error processing ${updateType} after ${duration}ms: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    throw error;
  }
};

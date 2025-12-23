import { Context, MiddlewareFn } from 'telegraf';
import { logger } from '../../utils/logger';

export function createSecurityMiddleware(allowedChatIds: number[]): MiddlewareFn<Context> {
  return async (ctx, next) => {
    if (!ctx.chat) {
      logger.warn('Received message without chat context');
      return;
    }

    const chatId = ctx.chat.id;

    if (!allowedChatIds.includes(chatId)) {
      logger.warn(
        `Unauthorized access attempt from chat ID: ${chatId} (user: ${ctx.from?.username || 'unknown'})`
      );
      return;
    }

    logger.debug(`Authorized message from chat ID: ${chatId}`);
    await next();
  };
}

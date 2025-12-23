import { Context } from 'telegraf';
import { GREETING_MESSAGE } from '../../llm/prompts';
import { logger } from '../../utils/logger';

export async function startCommand(ctx: Context): Promise<void> {
  const username = ctx.from?.username || ctx.from?.first_name || 'there';
  logger.info(`/start command from user: ${username}`);

  await ctx.reply(GREETING_MESSAGE, { parse_mode: 'Markdown' });
}

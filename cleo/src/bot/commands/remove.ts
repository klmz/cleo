import { Context } from 'telegraf';
import { ChoreService } from '../../services/ChoreService';
import { logger } from '../../utils/logger';

export function createRemoveCommand(choreService: ChoreService) {
  return async (ctx: Context): Promise<void> => {
    const username = ctx.from?.username || ctx.from?.first_name || 'unknown';
    logger.info(`/remove command from user: ${username}`);

    if (!('text' in ctx.message!)) {
      await ctx.reply('Please specify a chore name. Example: /remove dishes');
      return;
    }

    const text = ctx.message.text;
    const args = text.split(' ').slice(1);

    if (args.length === 0) {
      await ctx.reply('Please specify a chore name. Example: /remove dishes');
      return;
    }

    const choreName = args.join(' ').toLowerCase();
    const chore = choreService.getChoreByName(choreName);

    if (!chore) {
      await ctx.reply(
        `Chore "${choreName}" not found. Use /list to see all available chores.`
      );
      return;
    }

    try {
      choreService.deleteChore(chore.id);

      await ctx.reply(
        `\u{1F5D1} Chore *${chore.name}* has been removed.`,
        { parse_mode: 'Markdown' }
      );

      logger.info(`Chore "${chore.name}" removed by ${username}`);
    } catch (error) {
      logger.error(`Error removing chore: ${error}`);
      await ctx.reply('Sorry, there was an error removing the chore. Please try again.');
    }
  };
}

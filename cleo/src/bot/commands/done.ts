import { Context } from 'telegraf';
import { ChoreService } from '../../services/ChoreService';
import { logger } from '../../utils/logger';

export function createDoneCommand(choreService: ChoreService) {
  return async (ctx: Context): Promise<void> => {
    const username = ctx.from?.username || ctx.from?.first_name || 'unknown';
    logger.info(`/done command from user: ${username}`);

    if (!('text' in ctx.message!)) {
      await ctx.reply('Please specify a chore name. Example: /done litterbox');
      return;
    }

    const text = ctx.message.text;
    const args = text.split(' ').slice(1);

    if (args.length === 0) {
      await ctx.reply('Please specify a chore name. Example: /done litterbox');
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
      choreService.markChoreComplete({
        chore_id: chore.id,
        completed_by: username,
      });

      const updatedChore = choreService.getAllChoresWithStatus().find((c) => c.id === chore.id);
      const daysUntilDue = updatedChore?.days_until_due || 0;

      await ctx.reply(
        `\u{2705} Great job! *${chore.name}* marked as complete.\n\n` +
          `Next due: ${daysUntilDue} day${daysUntilDue !== 1 ? 's' : ''} from now.`,
        { parse_mode: 'Markdown' }
      );

      logger.info(`Chore "${chore.name}" marked complete by ${username}`);
    } catch (error) {
      logger.error(`Error marking chore complete: ${error}`);
      await ctx.reply('Sorry, there was an error marking the chore as complete. Please try again.');
    }
  };
}

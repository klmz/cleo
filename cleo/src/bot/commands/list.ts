import { Context } from 'telegraf';
import { ChoreService } from '../../services/ChoreService';
import { logger } from '../../utils/logger';

export function createListCommand(choreService: ChoreService) {
  return async (ctx: Context): Promise<void> => {
    logger.info(`/list command from user: ${ctx.from?.username || 'unknown'}`);

    const choresWithStatus = choreService.getAllChoresWithStatus();

    if (choresWithStatus.length === 0) {
      await ctx.reply('No chores found. Use /add to create your first chore!');
      return;
    }

    const overdueChores = choresWithStatus.filter((c) => c.is_overdue);
    const upcomingChores = choresWithStatus.filter((c) => !c.is_overdue);

    let message = '*Household Chores*\n\n';

    if (overdueChores.length > 0) {
      message += '*\u{1F534} Overdue:*\n';
      overdueChores.forEach((chore) => {
        const daysOverdue = Math.abs(chore.days_until_due);
        message += `\u{1F534} *${chore.name}* - ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} overdue\n`;
        if (chore.description) {
          message += `   _${chore.description}_\n`;
        }
      });
      message += '\n';
    }

    if (upcomingChores.length > 0) {
      message += '*\u{1F7E2} Upcoming:*\n';
      upcomingChores.forEach((chore) => {
        const daysText =
          chore.days_until_due === 0
            ? 'due today'
            : `due in ${chore.days_until_due} day${chore.days_until_due !== 1 ? 's' : ''}`;
        message += `\u{1F7E2} *${chore.name}* - ${daysText}\n`;
        if (chore.description) {
          message += `   _${chore.description}_\n`;
        }
      });
    }

    await ctx.reply(message, { parse_mode: 'Markdown' });
  };
}

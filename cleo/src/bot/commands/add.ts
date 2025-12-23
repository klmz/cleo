import { Context } from 'telegraf';
import { ChoreService } from '../../services/ChoreService';
import { logger } from '../../utils/logger';

function parseFrequency(frequencyStr: string): number | null {
  const match = frequencyStr.match(/^(\d+)(h|d|w)$/i);
  if (!match) return null;

  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  switch (unit) {
    case 'h':
      return value;
    case 'd':
      return value * 24;
    case 'w':
      return value * 24 * 7;
    default:
      return null;
  }
}

export function createAddCommand(choreService: ChoreService) {
  return async (ctx: Context): Promise<void> => {
    const username = ctx.from?.username || ctx.from?.first_name || 'unknown';
    logger.info(`/add command from user: ${username}`);

    if (!('text' in ctx.message!)) {
      await ctx.reply(
        'Usage: `/add <name> <frequency> [description]`\n\n' +
          'Frequency format: `1h` (hourly), `1d` (daily), `1w` (weekly)\n' +
          'Example: `/add dishes 1d Clean the dishes`',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    const text = ctx.message.text;
    const args = text.split(' ').slice(1);

    if (args.length < 2) {
      await ctx.reply(
        'Usage: `/add <name> <frequency> [description]`\n\n' +
          'Frequency format: `1h` (hourly), `1d` (daily), `1w` (weekly)\n' +
          'Example: `/add dishes 1d Clean the dishes`',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    const name = args[0].toLowerCase();
    const frequencyStr = args[1];
    const description = args.slice(2).join(' ') || undefined;

    const frequencyHours = parseFrequency(frequencyStr);

    if (frequencyHours === null) {
      await ctx.reply(
        'Invalid frequency format. Use:\n' +
          '- `1h` for hourly\n' +
          '- `1d` for daily\n' +
          '- `1w` for weekly\n\n' +
          'Example: `/add dishes 1d Clean the dishes`',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    const existingChore = choreService.getChoreByName(name);
    if (existingChore) {
      await ctx.reply(`A chore named "${name}" already exists. Use /remove to delete it first.`);
      return;
    }

    try {
      const chore = choreService.createChore({
        name,
        description,
        frequency_hours: frequencyHours,
        priority: 2,
      });

      await ctx.reply(
        `\u{2705} Chore *${chore.name}* created successfully!\n\n` +
          `Frequency: Every ${frequencyHours} hour${frequencyHours !== 1 ? 's' : ''}\n` +
          (description ? `Description: ${description}` : ''),
        { parse_mode: 'Markdown' }
      );

      logger.info(`Chore "${chore.name}" created by ${username}`);
    } catch (error) {
      logger.error(`Error creating chore: ${error}`);
      await ctx.reply('Sorry, there was an error creating the chore. Please try again.');
    }
  };
}

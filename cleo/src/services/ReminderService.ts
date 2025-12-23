import * as cron from 'node-cron';
import { ChoreService } from './ChoreService';
import { TelegramService } from './TelegramService';
import { getDatabase } from '../database/db';
import { logger } from '../utils/logger';

export class ReminderService {
  private choreService: ChoreService;
  private telegramService: TelegramService;
  private checkIntervalMinutes: number;
  private allowedChatIds: number[];
  private task: cron.ScheduledTask | null = null;

  constructor(
    choreService: ChoreService,
    telegramService: TelegramService,
    checkIntervalMinutes: number,
    allowedChatIds: number[]
  ) {
    this.choreService = choreService;
    this.telegramService = telegramService;
    this.checkIntervalMinutes = checkIntervalMinutes;
    this.allowedChatIds = allowedChatIds;
  }

  start(): void {
    const cronExpression = `*/${this.checkIntervalMinutes} * * * *`;

    logger.info(
      `Starting reminder service with check interval: ${this.checkIntervalMinutes} minutes`
    );

    this.task = cron.schedule(cronExpression, async () => {
      await this.checkAndSendReminders();
    });

    logger.info('Reminder service started successfully');
  }

  stop(): void {
    if (this.task) {
      logger.info('Stopping reminder service');
      this.task.stop();
      this.task = null;
      logger.info('Reminder service stopped');
    }
  }

  private async checkAndSendReminders(): Promise<void> {
    try {
      logger.debug('Checking for overdue chores');

      const overdueChores = this.choreService.getOverdueChores();

      if (overdueChores.length === 0) {
        logger.debug('No overdue chores found');
        return;
      }

      logger.info(`Found ${overdueChores.length} overdue chore(s)`);

      for (const chatId of this.allowedChatIds) {
        if (!this.shouldSendReminder(chatId)) {
          logger.debug(`Skipping reminder for chat ${chatId} (recently sent)`);
          continue;
        }

        await this.sendReminderMessage(chatId, overdueChores);
        this.updateLastReminderTime(chatId);
      }
    } catch (error) {
      logger.error(`Error checking and sending reminders: ${error}`);
    }
  }

  private async sendReminderMessage(
    chatId: number,
    overdueChores: Array<{ name: string; days_until_due: number; description: string | null }>
  ): Promise<void> {
    const choreList = overdueChores
      .map((chore) => {
        const daysOverdue = Math.abs(chore.days_until_due);
        return `\u{1F534} *${chore.name}* - ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} overdue`;
      })
      .join('\n');

    const message =
      `\u{1F514} *Chore Reminder*\n\n` +
      `You have ${overdueChores.length} overdue chore${overdueChores.length !== 1 ? 's' : ''}:\n\n` +
      choreList +
      `\n\nUse /done <chore> to mark them as complete!`;

    try {
      await this.telegramService.sendMessage(chatId, message);
      logger.info(`Reminder sent to chat ${chatId} for ${overdueChores.length} chore(s)`);
    } catch (error) {
      logger.error(`Failed to send reminder to chat ${chatId}: ${error}`);
    }
  }

  private shouldSendReminder(chatId: number): boolean {
    const db = getDatabase();
    const stmt = db.prepare(
      `SELECT value FROM system_state WHERE key = ?`
    );

    const key = `last_reminder_${chatId}`;
    const row = stmt.get(key) as { value: string } | undefined;

    if (!row) {
      return true;
    }

    const lastReminderTime = parseInt(row.value, 10);
    const now = Date.now();
    const hoursSinceLastReminder = (now - lastReminderTime) / (1000 * 60 * 60);

    const minHoursBetweenReminders = Math.max(this.checkIntervalMinutes / 60, 6);

    return hoursSinceLastReminder >= minHoursBetweenReminders;
  }

  private updateLastReminderTime(chatId: number): void {
    const db = getDatabase();
    const stmt = db.prepare(
      `INSERT OR REPLACE INTO system_state (key, value, updated_at) VALUES (?, ?, ?)`
    );

    const key = `last_reminder_${chatId}`;
    stmt.run(key, Date.now().toString(), Date.now());
  }
}

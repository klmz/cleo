import * as cron from 'node-cron';
import { ChoreService } from './ChoreService';
import { TelegramService } from './TelegramService';
import { HomeAssistantService } from './HomeAssistantService';
import { getDatabase } from '../database/db';
import { logger } from '../utils/logger';

export class ReminderService {
  private choreService: ChoreService;
  private telegramService: TelegramService;
  private homeAssistantService: HomeAssistantService | undefined;
  private checkIntervalMinutes: number;
  private allowedChatIds: number[];
  private kidsRoomEntities: string[];
  private task: cron.ScheduledTask | null = null;

  constructor(
    choreService: ChoreService,
    telegramService: TelegramService,
    checkIntervalMinutes: number,
    allowedChatIds: number[],
    homeAssistantService?: HomeAssistantService,
    kidsRoomEntities: string[] = []
  ) {
    this.choreService = choreService;
    this.telegramService = telegramService;
    this.homeAssistantService = homeAssistantService;
    this.checkIntervalMinutes = checkIntervalMinutes;
    this.allowedChatIds = allowedChatIds;
    this.kidsRoomEntities = kidsRoomEntities;
  }

  start(): void {
    const cronExpression = `*/${this.checkIntervalMinutes} * * * *`;

    logger.info(
      `Starting reminder service with check interval: ${this.checkIntervalMinutes} minutes`
    );

    this.task = cron.schedule(cronExpression, async () => {
      await this.checkAndSendReminders();
      if (this.homeAssistantService) {
        await this.checkLightsWhenAway();
        await this.checkKidsLights();
      }
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

  private async checkLightsWhenAway(): Promise<void> {
    if (!this.homeAssistantService) return;

    try {
      logger.debug('Checking lights when away');
      const states = await this.homeAssistantService.getStates();

      // Check if everyone is away
      const people = states.filter(s => s.entity_id.startsWith('person.'));
      const isAway = people.length > 0 && people.every(p => p.state === 'not_home');

      if (!isAway) {
        logger.debug('Someone is home, skipping light check');
        return;
      }

      // Check for lights left on
      const lightsOn = states.filter(s =>
        s.entity_id.startsWith('light.') &&
        s.state === 'on' &&
        !s.attributes.is_hue_group // simplistic filter to avoid duplicates if using Hue groups
      );

      if (lightsOn.length === 0) return;

      logger.info(`Found ${lightsOn.length} lights on while everyone is away`);

      // Rate limit check
      const key = 'last_away_light_reminder';
      if (!this.shouldSendGenericReminder(key, 60)) { // 1 hour cool down
        return;
      }

      const message = `\u{1F3E0} *Away Mode Warning*\n\n` +
        `Everyone seems to be away, but the following lights are still on:\n` +
        lightsOn.map(l => `- ${l.attributes.friendly_name || l.entity_id}`).join('\n') +
        `\n\nWould you like to turn them off?`;

      // In a real implementation we would attach buttons here.
      // For now, let's just send the message. 
      // We will need to enhance TelegramService to support buttons to make this actionable.

      for (const chatId of this.allowedChatIds) {
        await this.telegramService.sendMessage(
          chatId,
          message,
          lightsOn.map((l) => l.entity_id)
        );
      }

      this.updateGenericReminderTime(key);

    } catch (error) {
      logger.error(`Error checking lights when away: ${error}`);
    }
  }

  private async checkKidsLights(): Promise<void> {
    if (!this.homeAssistantService || this.kidsRoomEntities.length === 0) return;

    try {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();

      // Check if it's after bedtime (20:30)
      if (hours < 20 || (hours === 20 && minutes < 30)) {
        return;
      }

      // Don't annoy too late? Or maybe we SHOULD? 
      // Let's stick to simple "is it night time"

      logger.debug('Checking kids room lights (bedtime)');

      const lightsOn: { name: string; entity_id: string }[] = [];

      for (const entityId of this.kidsRoomEntities) {
        const state = await this.homeAssistantService.getState(entityId);
        if (state && state.state === 'on') {
          lightsOn.push({
            name: state.attributes.friendly_name || entityId,
            entity_id: entityId,
          });
        }
      }

      if (lightsOn.length === 0) return;

      logger.info(`Kids room lights on past bedtime: ${lightsOn.map((l) => l.name).join(', ')}`);

      // Rate limit: don't spam every minute. Maybe once every 30 mins?
      const key = 'last_kids_light_reminder';
      if (!this.shouldSendGenericReminder(key, 30)) {
        return;
      }

      const message = `\u{1F6CF} *Bedtime Alert*\n\n` +
        `It's past 20:30 and the following lights are still on:\n` +
        lightsOn.map((l) => `- ${l.name}`).join('\n');

      for (const chatId of this.allowedChatIds) {
        await this.telegramService.sendMessage(
          chatId,
          message,
          lightsOn.map((l) => l.entity_id)
        );
      }

      this.updateGenericReminderTime(key);

    } catch (error) {
      logger.error(`Error checking kids lights: ${error}`);
    }
  }

  private shouldSendGenericReminder(key: string, cooldownMinutes: number): boolean {
    const db = getDatabase();
    const stmt = db.prepare(`SELECT value FROM system_state WHERE key = ?`);
    const row = stmt.get(key) as { value: string } | undefined;

    if (!row) return true;

    const lastTime = parseInt(row.value, 10);
    const now = Date.now();
    const minutesSince = (now - lastTime) / (1000 * 60);

    return minutesSince >= cooldownMinutes;
  }

  private updateGenericReminderTime(key: string): void {
    const db = getDatabase();
    const stmt = db.prepare(
      `INSERT OR REPLACE INTO system_state (key, value, updated_at) VALUES (?, ?, ?)`
    );
    stmt.run(key, Date.now().toString(), Date.now());
  }
}


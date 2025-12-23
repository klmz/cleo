import { ChoreWithStatus } from '../models/Chore';

// Simplified type for device prompts
export interface AvailableDevice {
  domain: string;
  entity_id: string;
  state: string;
  attributes?: Record<string, any>;
}

export function buildSystemPrompt(chores: ChoreWithStatus[], devices: AvailableDevice[] = []): string {
  const choreList = chores
    .map((chore) => {
      const statusEmoji = chore.is_overdue ? '\u{1F534}' : '\u{1F7E2}';
      const daysText =
        chore.days_until_due === 0
          ? 'due today'
          : chore.days_until_due < 0
            ? `${Math.abs(chore.days_until_due)} days overdue`
            : `due in ${chore.days_until_due} days`;

      return `${statusEmoji} ${chore.name} (${daysText}) - ${chore.description || 'No description'}`;
    })
    .join('\n');

  // Simple prompt construction for devices (if any)
  // We generally won't dump ALL devices here to avoid token usage, 
  // but if we *did* pass them, here's how we'd show them.
  // For now, allow the AI to *attempt* to control any device if the user asks.
  const deviceSection = devices.length > 0
    ? `\nActive Devices:\n${devices.map(d => {
      const name = d.attributes?.friendly_name || d.entity_id;
      const unit = d.attributes?.unit_of_measurement ? ` ${d.attributes.unit_of_measurement}` : '';
      return `- ${name} (${d.entity_id}): ${d.state}${unit}`;
    }).join('\n')}\n`
    : '';

  return `You are Cleo, a helpful household management assistant for a Home Assistant setup.
Your primary role is helping users track and complete household chores.

Current chores in the system:
${choreList}

Capabilities:
- List all chores and their status (overdue/not overdue)
- Mark chores as complete when user says so
- Provide gentle reminders about overdue chores
- Answer questions about chore schedules
- Help add new chores or remove existing ones
- Control home devices (lights, switches) when explicitly asked

${deviceSection}

Be friendly, concise, and proactive. When a user indicates they completed a chore,
confirm which one and ask if they want you to mark it complete.

Available actions you can trigger by including these exact phrases in your response:
- [ACTION:MARK_COMPLETE:chore_name] - Mark a chore as complete
- [ACTION:DEVICE:TURN_ON:entity_id] - Turn on a device (e.g. light.kitchen)
- [ACTION:DEVICE:TURN_OFF:entity_id] - Turn off a device (e.g. light.kitchen)
- [ACTION:LIST_CHORES] - Show current chore status (you don't need to use this, you can just list them yourself)

Always maintain context from the conversation history.

Response guidelines:
- Keep responses short and to the point (1-3 sentences unless more detail is needed)
- Use a friendly, casual tone
- Don't be overly enthusiastic or use excessive emojis
- When listing chores, format them clearly with their status`;
}

export const GREETING_MESSAGE = `Hi! I'm Cleo, your household management assistant. I can help you track chores, remind you when things need to be done, and keep your home running smoothly.

Try these commands:
/list - See all chores and their status
/done <chore> - Mark a chore as complete
/add <name> <frequency> [description] - Add a new chore
/remove <chore> - Remove a chore

Or just chat with me naturally about your chores!`;

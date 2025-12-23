# Cleo Household Manager - Detailed Documentation

## Overview

Cleo is an intelligent household management assistant that helps you track and manage household chores through a Telegram bot interface powered by Google Gemini AI.

## Architecture

### Components

1. **Telegram Bot** (Telegraf): Handles all user interactions
2. **Google Gemini AI**: Provides natural language understanding
3. **SQLite Database**: Stores chores, history, and chat messages
4. **Reminder Service**: Periodic checks for overdue chores
5. **Home Assistant Integration**: Runs as a supervised add-on

### Data Storage

All data is stored in `/data/cleo.db` and persists across container restarts.

Database tables:
- `chores`: Chore definitions
- `chore_history`: Completion records
- `chat_messages`: Conversation history for context
- `system_state`: Internal state (schema version, reminder timestamps)

## Configuration Details

### Telegram Bot Setup

1. Open Telegram and search for [@BotFather](https://t.me/botfather)
2. Send `/newbot` and follow the prompts
3. Copy the bot token (format: `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`)
4. Start a chat with your new bot
5. Get your chat ID:
   - Send any message to your bot
   - Visit `https://api.telegram.org/bot<TOKEN>/getUpdates`
   - Find the `chat.id` number

### Google Gemini API Setup

1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the API key (starts with `AIzaSy`)

### Security Considerations

- **allowed_chat_ids**: Only specified chat IDs can interact with the bot
- Unauthorized access attempts are logged but not acknowledged
- Bot tokens and API keys are stored securely in Home Assistant

## Chore Management

### Chore Properties

Each chore has:
- **Name**: Unique identifier (lowercase recommended)
- **Description**: Optional human-readable description
- **Frequency**: How often it should be done (in hours)
- **Priority**: 1 (low), 2 (medium), 3 (high)
- **Active**: Whether the chore is enabled

### Due Date Calculation

A chore's due date is calculated as:
```
due_date = last_completion_time + frequency_hours
```

If never completed, uses the chore's creation time as the base.

### Status Indicators

- 🔴 **Overdue**: Current time >= due date
- 🟢 **Upcoming**: Not yet overdue

## AI Integration

### Model Selection

Cleo uses two Gemini models based on query complexity:

**Gemini 2.0 Flash** (fast, inexpensive):
- Simple chore status queries
- Quick confirmations
- Basic list/done commands
- Short messages (<50 characters with simple keywords)

**Gemini 2.0 Pro** (slower, more capable):
- Complex reasoning ("What should I prioritize?")
- Long conversations requiring context
- Messages with keywords like "why", "should", "recommend"
- Messages over 200 characters

The model router automatically selects the appropriate model. If Flash fails, it falls back to Pro.

### Action Parsing

The AI can trigger actions by including markers in responses:
- `[ACTION:MARK_COMPLETE:chore_name]`: Marks a chore as complete

These markers are stripped from the user-facing response.

### Chat History

- Stores last 10 messages per chat for context
- Includes both user and assistant messages
- Tracks which model was used for each response

## Reminder System

### How It Works

1. **Periodic Checks**: Runs every N minutes (configurable)
2. **Overdue Detection**: Finds chores where current_time >= due_date
3. **Rate Limiting**: Won't send reminders more than once per 6 hours (or check interval, whichever is greater)
4. **Multi-Chat**: Sends reminders to all allowed chat IDs

### Reminder Format

```
🔔 Chore Reminder

You have 2 overdue chores:

🔴 litterbox - 1 day overdue
🔴 dishes - 2 days overdue

Use /done <chore> to mark them as complete!
```

## Command Reference

### /start
Shows welcome message and available commands.

### /list
Displays all active chores grouped by status:
- Overdue chores (🔴)
- Upcoming chores (🟢)

Shows days overdue or days until due for each chore.

### /done <chore>
Marks a chore as complete.

Examples:
- `/done litterbox`
- `/done vacuum`

Records who completed it and when. Updates the due date calculation.

### /add <name> <frequency> [description]
Creates a new chore.

Frequency format:
- `Nh`: Every N hours (e.g., `12h`)
- `Nd`: Every N days (e.g., `2d`)
- `Nw`: Every N weeks (e.g., `1w`)

Examples:
- `/add laundry 3d Do the laundry`
- `/add plants 1w Water the plants`
- `/add litter 1d`

### /remove <chore>
Deletes a chore (soft delete - sets active=0).

Examples:
- `/remove dishes`
- `/remove laundry`

## Advanced Features

### Conversation Context

Cleo maintains conversation history to understand context:

```
User: What chores are overdue?
Cleo: You have 1 overdue chore: litterbox (2 days overdue)
User: I'll do it now
Cleo: Great! Would you like me to mark litterbox as complete?
User: Yes
Cleo: [Marks it complete] Done! Litterbox is now due in 1 day.
```

### Natural Language Understanding

Cleo understands various phrasings:
- "Show me the chores" → Lists chores
- "I cleaned the bathroom" → Offers to mark complete
- "What's due today?" → Shows due chores
- "Help me prioritize" → Uses AI reasoning

## Troubleshooting

### Logs

Access logs through Home Assistant:
1. Go to Add-ons → Cleo Household Manager
2. Click the "Log" tab
3. Set log_level to "debug" for detailed logs

### Common Issues

**Bot not responding:**
- Check bot token is correct
- Verify chat ID is in allowed_chat_ids
- Check add-on is running (not crashed)

**AI responses seem wrong:**
- Check Gemini API key is valid
- Verify you're not hitting rate limits
- Check the logs for API errors

**Reminders not sending:**
- Ensure chores are actually overdue
- Check reminder_check_interval is set
- Verify the add-on has been running long enough
- Check rate limiting (min 6 hours between reminders)

**Database errors:**
- Check /data directory is writable
- Look for migration errors in logs
- Database is automatically created on first run

### Reset Database

To start fresh:
1. Stop the add-on
2. Delete `/data/cleo.db` through File Editor or SSH
3. Start the add-on (database will be recreated)

## API Rate Limits

### Gemini Free Tier

- **Flash**: 10 requests per minute, 1500 per day
- **Pro**: 5 requests per minute, 50 per day

The add-on is designed to stay well within these limits for typical household use (5-10 interactions per day).

### Telegram Bot API

- 30 messages per second per bot
- Far exceeds typical household use

## Future Enhancements

Planned features:
- Home Assistant entity integration (sensors for chore status)
- Multiple household members with task assignment
- Voice assistant integration
- Image recognition for chore verification
- Advanced scheduling (specific days/times)
- Chore rotation and gamification

## Contributing

This is an open-source project. Contributions welcome!

## Privacy

- All data stored locally in Home Assistant
- Telegram messages stored in local database
- OpenAI API calls include message content but no personal identifiers
- No data shared with third parties except Google (for AI) and Telegram (for messaging)

## Support

For issues or questions:
1. Check this documentation
2. Review the logs
3. Open a GitHub issue with details

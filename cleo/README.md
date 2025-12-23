# Cleo Household Manager

A Home Assistant add-on for tracking household chores with a Telegram bot and AI assistant powered by Google Gemini.

## Features

- **Chore Tracking**: Automatically track when chores were last done and when they're due
- **Telegram Bot Interface**: Manage chores through simple commands or natural conversation
- **AI Assistant**: Powered by Google Gemini for natural language understanding
- **Automatic Reminders**: Get notified when chores are overdue
- **Multi-tier LLM**: Uses Gemini Flash for simple queries and Pro for complex reasoning (cost-optimized)

## Installation

1. Add this repository to your Home Assistant add-ons store
2. Install the "Cleo Household Manager" add-on
3. Configure the add-on (see Configuration section)
4. Start the add-on

## Configuration

### Required Settings

- **telegram_token**: Your Telegram bot token (get from [@BotFather](https://t.me/botfather))
- **gemini_api_key**: Your Google Gemini API key (get from [Google AI Studio](https://aistudio.google.com/app/apikey))
- **allowed_chat_ids**: Comma-separated list of Telegram chat IDs that can use the bot

### Optional Settings

- **reminder_check_interval**: How often to check for overdue chores (5-1440 minutes, default: 60)
- **log_level**: Logging verbosity (debug/info/warn/error, default: info)
- **homeassistant_url**: Home Assistant URL (for future features)
- **homeassistant_token**: Home Assistant long-lived access token (for future features)

### Getting Your Telegram Chat ID

1. Start a chat with your bot
2. Send any message
3. Visit `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
4. Look for the `chat.id` field in the response

Example configuration:

```yaml
telegram_token: "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
gemini_api_key: "AIzaSyC..."
allowed_chat_ids: "123456789,987654321"
reminder_check_interval: 60
log_level: info
```

## Usage

### Commands

- `/start` - Get started and see available commands
- `/list` - View all chores and their status
- `/done <chore>` - Mark a chore as complete (e.g., `/done litterbox`)
- `/add <name> <frequency> [description]` - Add a new chore
  - Frequency format: `1h` (hourly), `1d` (daily), `1w` (weekly)
  - Example: `/add dishes 1d Clean the dishes`
- `/remove <chore>` - Remove a chore

### Natural Conversation

You can also just chat naturally with Cleo:

- "What chores need to be done?"
- "I just cleaned the litterbox"
- "Which chores are overdue?"
- "What should I prioritize today?"

## Default Chores

The add-on comes with these sample chores:

- **Vacuuming**: Weekly
- **Litterbox**: Daily
- **Trash**: Every 3 days
- **Dishes**: Daily

You can remove or modify these using the `/remove` and `/add` commands.

## Cost Information

This add-on uses Google Gemini's API with the free tier:

- **Gemini 2.0 Flash**: 10 requests per minute (used for most interactions)
- **Gemini 2.0 Pro**: 5 requests per minute (used for complex reasoning)

The add-on automatically routes requests to minimize API costs while maintaining quality.

## Troubleshooting

### Bot doesn't respond

1. Check that your bot token is correct
2. Verify your chat ID is in the allowed list
3. Check the add-on logs for errors

### Reminders not working

1. Check that at least one chore is overdue
2. Verify the reminder check interval is set correctly
3. Reminders are rate-limited to avoid spam (minimum 6 hours between reminders)

### API errors

1. Verify your Gemini API key is valid
2. Check you haven't exceeded the free tier rate limits
3. Review the add-on logs for specific error messages

## Support

For issues, questions, or feature requests, please open an issue on GitHub.

## License

MIT

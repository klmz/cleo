#!/usr/bin/with-contenv bashio

CONFIG_PATH=/data/options.json

bashio::log.info "Starting Cleo Household Manager..."

export TELEGRAM_TOKEN=$(bashio::config 'telegram_token')
export GEMINI_API_KEY=$(bashio::config 'gemini_api_key')
export ALLOWED_CHAT_IDS=$(bashio::config 'allowed_chat_ids')
export REMINDER_CHECK_INTERVAL=$(bashio::config 'reminder_check_interval')
export LOG_LEVEL=$(bashio::config 'log_level')

if bashio::config.has_value 'homeassistant_url'; then
    export HOMEASSISTANT_URL=$(bashio::config 'homeassistant_url')
fi

if bashio::config.has_value 'homeassistant_token'; then
    export HOMEASSISTANT_TOKEN=$(bashio::config 'homeassistant_token')
fi

export OPTIONS_PATH=$CONFIG_PATH
export DB_PATH=/data/cleo.db

bashio::log.info "Configuration loaded"
bashio::log.info "Reminder check interval: ${REMINDER_CHECK_INTERVAL} minutes"
bashio::log.info "Log level: ${LOG_LEVEL}"

cd /app
exec node dist/index.js

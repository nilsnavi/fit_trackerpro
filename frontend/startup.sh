#!/bin/sh
set -e

# Runtime config for the SPA (window.__APP_CONFIG__) — must run before nginx serves /config.js.
# Defaults match local dev; override via container environment at deploy time.
export API_URL="${API_URL:-http://localhost:8000/api/v1}"
export TELEGRAM_BOT_USERNAME="${TELEGRAM_BOT_USERNAME:-}"
export TELEGRAM_WEBAPP_URL="${TELEGRAM_WEBAPP_URL:-}"

CONFIG_TEMPLATE="/usr/share/nginx/html/config.template.js"
CONFIG_OUT="/usr/share/nginx/html/config.js"

if [ ! -r "$CONFIG_TEMPLATE" ]; then
    echo "startup: missing or unreadable $CONFIG_TEMPLATE" >&2
    exit 1
fi

envsubst '${API_URL} ${TELEGRAM_BOT_USERNAME} ${TELEGRAM_WEBAPP_URL}' \
    < "$CONFIG_TEMPLATE" \
    > "$CONFIG_OUT"

exec nginx -g 'daemon off;'

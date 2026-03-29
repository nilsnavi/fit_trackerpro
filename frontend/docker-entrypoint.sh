#!/bin/sh
set -e

# Defaults match local dev; override via container environment at deploy time.
export API_URL="${API_URL:-http://localhost:8000/api/v1}"
export TELEGRAM_BOT_USERNAME="${TELEGRAM_BOT_USERNAME:-}"
export TELEGRAM_WEBAPP_URL="${TELEGRAM_WEBAPP_URL:-}"

envsubst '${API_URL} ${TELEGRAM_BOT_USERNAME} ${TELEGRAM_WEBAPP_URL}' \
  < /usr/share/nginx/html/config.template.js \
  > /usr/share/nginx/html/config.js

exec nginx -g 'daemon off;'

#!/bin/sh
# Подставляет адреса бэкенда для scrape и blackbox (сеть Docker / имя сервиса).
# Переменные (значения по умолчанию — как в корневом docker-compose, сервис backend:8000):
#   FITTRACKER_BACKEND_SCRAPE_TARGET   host:port для Prometheus (например backend:8000)
#   FITTRACKER_BACKEND_READINESS_URL   полный URL для blackbox (например http://backend:8000/api/v1/system/ready)
set -e
SCRAPE="${FITTRACKER_BACKEND_SCRAPE_TARGET:-backend:8000}"
READY="${FITTRACKER_BACKEND_READINESS_URL:-http://backend:8000/api/v1/system/ready}"
sed -e "s#__BACKEND_SCRAPE__#${SCRAPE}#g" \
    -e "s#__BLACKBOX_READY_URL__#${READY}#g" \
  /etc/prometheus/prometheus.yml.template > /tmp/prometheus.generated.yml
exec /bin/prometheus --config.file=/tmp/prometheus.generated.yml "$@"

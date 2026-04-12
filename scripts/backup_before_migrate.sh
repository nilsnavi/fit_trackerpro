#!/usr/bin/env bash
# Автоматический бэкап перед alembic upgrade head
# Использование: из каталога деплоя (например ~/fittracker-pro):
#   ./scripts/backup_before_migrate.sh
#
# Подключение к PostgreSQL: переменные POSTGRES_* из backend/.env (если есть),
# иначе из .env в корне репозитория/деплоя.
#
# Файл дампа: backups/pre_migrate_<timestamp>.sql на хосте (в prod тот же каталог
# смонтирован в контейнер postgres как /backups — см. docker-compose.prod.yml).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

load_env_file() {
  local f="$1"
  if [[ ! -f "$f" ]]; then
    return 1
  fi
  set -a
  # shellcheck disable=SC1090
  source "$f"
  set +a
  return 0
}

if ! load_env_file "${REPO_ROOT}/backend/.env"; then
  if ! load_env_file "${REPO_ROOT}/.env"; then
    echo "error: не найден ни backend/.env, ни .env в ${REPO_ROOT}" >&2
    exit 1
  fi
fi

: "${POSTGRES_USER:?POSTGRES_USER не задан (backend/.env или .env)}"
: "${POSTGRES_DB:?POSTGRES_DB не задан (backend/.env или .env)}"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
if [[ ! -f "${REPO_ROOT}/${COMPOSE_FILE}" ]]; then
  COMPOSE_FILE="docker-compose.yml"
fi

mkdir -p "${REPO_ROOT}/backups"
STAMP="$(date +%Y%m%d_%H%M%S)"
HOST_BACKUP="${REPO_ROOT}/backups/pre_migrate_${STAMP}.sql"

echo "Бэкап БД перед миграцией (compose: ${COMPOSE_FILE})..."
set +e
docker-compose -f "${REPO_ROOT}/${COMPOSE_FILE}" exec -T postgres \
  pg_dump -U "${POSTGRES_USER}" "${POSTGRES_DB}" > "${HOST_BACKUP}" 2>&1
STATUS=$?
set -e
if [[ "${STATUS}" -ne 0 ]]; then
  cat "${HOST_BACKUP}" >&2 || true
  rm -f "${HOST_BACKUP}"
  echo "error: pg_dump завершился с кодом ${STATUS}" >&2
  exit "${STATUS}"
fi

SIZE_BYTES="$(wc -c < "${HOST_BACKUP}" | tr -d ' ')"
echo "Бэкап записан: ${HOST_BACKUP} (${SIZE_BYTES} байт)"
printf '%s\n' "${HOST_BACKUP}" > "${REPO_ROOT}/backups/.last_pre_migrate_backup_path"

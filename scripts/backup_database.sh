#!/usr/bin/env bash
# Host-side PostgreSQL backup for the production Compose stack.
# Required configuration is supplied by the systemd EnvironmentFile or .env.

set -Eeuo pipefail
umask 077

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="${FITTRACKER_REPO_ROOT:-$(cd "${SCRIPT_DIR}/.." && pwd)}"
COMPOSE_FILE="${COMPOSE_FILE:-${REPO_ROOT}/docker-compose.prod.yml}"
BACKUPS_DIR="${BACKUPS_DIR:-}"
MIN_BYTES="${BACKUP_MIN_BYTES:-1024}"
OFFSITE_TARGET="${BACKUP_OFFSITE_TARGET:-}"
ALERT_WEBHOOK="${BACKUP_ALERT_WEBHOOK:-${SLACK_WEBHOOK_URL:-}}"

notify_failure() {
  local message="$1"
  printf '%s\n' "backup failure: ${message}" >&2
  if [[ -n "${ALERT_WEBHOOK}" ]]; then
    curl --fail --silent --show-error --max-time 20 \
      -H 'Content-Type: application/json' \
      --data "{\"text\":\"FitTracker backup failed: ${message}\"}" \
      "${ALERT_WEBHOOK}" >/dev/null || printf '%s\n' 'backup failure alert delivery also failed' >&2
  fi
}

on_error() {
  local status="$?"
  notify_failure "backup job exited at line ${BASH_LINENO[0]} (status ${status})"
  exit "${status}"
}
trap on_error ERR

load_env_if_needed() {
  if [[ -n "${POSTGRES_USER:-}" && -n "${POSTGRES_DB:-}" && -n "${BACKUPS_DIR:-}" ]]; then
    return
  fi

  local env_file="${FITTRACKER_ENV_FILE:-${REPO_ROOT}/.env}"
  [[ -f "${env_file}" ]] || { notify_failure "environment file is missing: ${env_file}"; exit 1; }
  set -a
  # shellcheck disable=SC1090
  source "${env_file}"
  set +a
  BACKUPS_DIR="${BACKUPS_DIR:-}"
  OFFSITE_TARGET="${BACKUP_OFFSITE_TARGET:-${OFFSITE_TARGET}}"
  ALERT_WEBHOOK="${BACKUP_ALERT_WEBHOOK:-${SLACK_WEBHOOK_URL:-${ALERT_WEBHOOK}}}"
}

require_command() {
  command -v "$1" >/dev/null || { notify_failure "required command is unavailable: $1"; exit 1; }
}

copy_tier() {
  local tier="$1"
  local archive="$2"
  mkdir -p "${BACKUPS_DIR}/${tier}"
  cp --preserve=mode,timestamps "${archive}" "${BACKUPS_DIR}/${tier}/$(basename "${archive}")"
  cp --preserve=mode,timestamps "${archive}.sha256" "${BACKUPS_DIR}/${tier}/$(basename "${archive}").sha256"
}

prune_tier() {
  local tier="$1"
  local keep="$2"
  local path="${BACKUPS_DIR}/${tier}"
  local archive
  mapfile -t stale < <(find "${path}" -maxdepth 1 -type f -name '*.dump' -printf '%T@ %p\n' | sort -rn | tail -n "+$((keep + 1))" | cut -d' ' -f2-)
  for archive in "${stale[@]:-}"; do
    [[ -n "${archive}" ]] || continue
    rm -f "${archive}" "${archive}.sha256"
  done
}

load_env_if_needed
: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_DB:?POSTGRES_DB is required}"
: "${BACKUPS_DIR:?BACKUPS_DIR is required and must be outside the repository}"
: "${OFFSITE_TARGET:?BACKUP_OFFSITE_TARGET is required for offsite backups}"
: "${ALERT_WEBHOOK:?BACKUP_ALERT_WEBHOOK or SLACK_WEBHOOK_URL is required for failure alerts}"

require_command docker
require_command rclone
require_command sha256sum
require_command flock
require_command curl
[[ -f "${COMPOSE_FILE}" ]] || { notify_failure "Compose file is missing: ${COMPOSE_FILE}"; exit 1; }

mkdir -p "${BACKUPS_DIR}"/{daily,weekly,monthly,status}
exec 9>"${BACKUPS_DIR}/.backup.lock"
flock -n 9 || { notify_failure 'another backup job is already running'; exit 1; }

export BACKUPS_DIR
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
filename="fittracker_${stamp}.dump"
archive="${BACKUPS_DIR}/daily/${filename}"
partial="${archive}.part"

docker compose -f "${COMPOSE_FILE}" exec -T postgres \
  pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -Fc > "${partial}"

size="$(wc -c < "${partial}" | tr -d ' ')"
(( size >= MIN_BYTES )) || { notify_failure "archive is too small (${size} bytes)"; rm -f "${partial}"; exit 1; }
docker compose -f "${COMPOSE_FILE}" exec -T postgres pg_restore --list < "${partial}" >/dev/null
mv "${partial}" "${archive}"
sha256sum "${archive}" > "${archive}.sha256"

weekday="$(date -u +%u)"
day_of_month="$(date -u +%d)"
if [[ "${weekday}" == '1' ]]; then
  copy_tier weekly "${archive}"
fi
if [[ "${day_of_month}" == '01' ]]; then
  copy_tier monthly "${archive}"
fi

# Upload and confirm the new daily archive before deleting any local retention data.
rclone copy "${BACKUPS_DIR}/daily" "${OFFSITE_TARGET}/daily"
if [[ "${weekday}" == '1' ]]; then rclone copy "${BACKUPS_DIR}/weekly" "${OFFSITE_TARGET}/weekly"; fi
if [[ "${day_of_month}" == '01' ]]; then rclone copy "${BACKUPS_DIR}/monthly" "${OFFSITE_TARGET}/monthly"; fi
rclone lsf "${OFFSITE_TARGET}/daily" | grep -Fx "${filename}" >/dev/null

prune_tier daily 7
prune_tier weekly 4
prune_tier monthly 3
cat > "${BACKUPS_DIR}/status/last-backup.env" <<EOF
BACKUP_STATUS=success
BACKUP_FINISHED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)
BACKUP_ARCHIVE=${filename}
BACKUP_SIZE_BYTES=${size}
BACKUP_OFFSITE_CONFIRMED=true
EOF

printf 'backup complete: %s (%s bytes), offsite confirmed\n' "${archive}" "${size}"

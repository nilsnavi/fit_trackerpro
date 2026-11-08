#!/usr/bin/env bash
# Weekly restore drill. Restores the newest custom archive into a disposable DB only.

set -Eeuo pipefail
umask 077

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="${FITTRACKER_REPO_ROOT:-$(cd "${SCRIPT_DIR}/.." && pwd)}"
COMPOSE_FILE="${COMPOSE_FILE:-${REPO_ROOT}/docker-compose.prod.yml}"
BACKUPS_DIR="${BACKUPS_DIR:-}"
ALERT_WEBHOOK="${BACKUP_ALERT_WEBHOOK:-${SLACK_WEBHOOK_URL:-}}"
RESTORE_DB=""

notify_failure() {
  local message="$1"
  printf '%s\n' "restore drill failure: ${message}" >&2
  if [[ -n "${ALERT_WEBHOOK}" ]]; then
    curl --fail --silent --show-error --max-time 20 -H 'Content-Type: application/json' \
      --data "{\"text\":\"FitTracker restore drill failed: ${message}\"}" \
      "${ALERT_WEBHOOK}" >/dev/null || printf '%s\n' 'restore drill alert delivery also failed' >&2
  fi
}

cleanup() {
  [[ -n "${RESTORE_DB}" ]] || return
  docker compose -f "${COMPOSE_FILE}" exec -T postgres \
    psql -v ON_ERROR_STOP=1 -U "${POSTGRES_USER}" -d postgres \
    -c "DROP DATABASE IF EXISTS \"${RESTORE_DB}\" WITH (FORCE);" >/dev/null || true
}

on_error() {
  local status="$?"
  notify_failure "restore drill exited at line ${BASH_LINENO[0]} (status ${status})"
  exit "${status}"
}
trap cleanup EXIT
trap on_error ERR

if [[ -z "${POSTGRES_USER:-}" || -z "${POSTGRES_DB:-}" || -z "${BACKUPS_DIR:-}" ]]; then
  env_file="${FITTRACKER_ENV_FILE:-${REPO_ROOT}/.env}"
  [[ -f "${env_file}" ]] || { notify_failure "environment file is missing: ${env_file}"; exit 1; }
  set -a
  # shellcheck disable=SC1090
  source "${env_file}"
  set +a
  ALERT_WEBHOOK="${BACKUP_ALERT_WEBHOOK:-${SLACK_WEBHOOK_URL:-${ALERT_WEBHOOK}}}"
fi
: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${BACKUPS_DIR:?BACKUPS_DIR is required}"
: "${ALERT_WEBHOOK:?BACKUP_ALERT_WEBHOOK or SLACK_WEBHOOK_URL is required for failure alerts}"
command -v docker >/dev/null || { notify_failure 'required command is unavailable: docker'; exit 1; }
command -v sha256sum >/dev/null || { notify_failure 'required command is unavailable: sha256sum'; exit 1; }
command -v curl >/dev/null || { notify_failure 'required command is unavailable: curl'; exit 1; }
[[ -f "${COMPOSE_FILE}" ]] || { notify_failure "Compose file is missing: ${COMPOSE_FILE}"; exit 1; }

archive="$(find "${BACKUPS_DIR}/daily" "${BACKUPS_DIR}/weekly" "${BACKUPS_DIR}/monthly" -type f -name '*.dump' -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -n1 | cut -d' ' -f2-)"
[[ -n "${archive}" && -f "${archive}" ]] || { notify_failure 'no custom-format backup archive found'; exit 1; }
[[ -f "${archive}.sha256" ]] || { notify_failure "checksum is missing for $(basename "${archive}")"; exit 1; }
(cd "$(dirname "${archive}")" && sha256sum -c "$(basename "${archive}").sha256")

export BACKUPS_DIR
relative_archive="${archive#"${BACKUPS_DIR}/"}"
[[ "${relative_archive}" != "${archive}" ]] || { notify_failure 'archive is outside BACKUPS_DIR'; exit 1; }
RESTORE_DB="fittracker_restore_check_$(date -u +%Y%m%d%H%M%S)_$RANDOM"

docker compose -f "${COMPOSE_FILE}" exec -T postgres \
  psql -v ON_ERROR_STOP=1 -U "${POSTGRES_USER}" -d postgres -c "CREATE DATABASE \"${RESTORE_DB}\";" >/dev/null
docker compose -f "${COMPOSE_FILE}" exec -T postgres \
  pg_restore --exit-on-error --no-owner --no-privileges -U "${POSTGRES_USER}" \
  -d "${RESTORE_DB}" "/backups/${relative_archive}"

for table in alembic_version users workout_logs workout_sets workout_session_exercises; do
  count="$(docker compose -f "${COMPOSE_FILE}" exec -T postgres \
    psql -v ON_ERROR_STOP=1 -A -t -U "${POSTGRES_USER}" -d "${RESTORE_DB}" \
    -c "SELECT count(*) FROM \"${table}\";" | tr -d '[:space:]')"
  [[ "${count}" =~ ^[0-9]+$ ]] || { notify_failure "invalid count returned for ${table}"; exit 1; }
done

mkdir -p "${BACKUPS_DIR}/status"
cat > "${BACKUPS_DIR}/status/last-restore-test.env" <<EOF
RESTORE_TEST_STATUS=success
RESTORE_TEST_FINISHED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)
RESTORE_TEST_ARCHIVE=$(basename "${archive}")
EOF
printf 'restore drill complete: %s\n' "$(basename "${archive}")"

#!/usr/bin/env bash
# Вызывается по SSH из GitHub Actions: git sync на заданный SHA и пересборка/перезапуск backend + frontend.
# Аргументы: REMOTE_PATH COMMIT_SHA STRATEGY [COMPOSE_EXTRA]
# STRATEGY: build | pull
# COMPOSE_EXTRA: необязательные аргументы перед subcommand (например: -f docker-compose.yml -f docker-compose.prod.yml)
set -Eeuo pipefail

REMOTE_PATH="${1:?REMOTE_PATH required}"
COMMIT_SHA="${2:?COMMIT_SHA required}"
STRATEGY="${3:-build}"
COMPOSE_EXTRA="${4:-}"

if [[ "${STRATEGY}" != "build" && "${STRATEGY}" != "pull" ]]; then
  echo "STRATEGY must be build or pull" >&2
  exit 1
fi

cd "${REMOTE_PATH}"
git config --global --add safe.directory "${REMOTE_PATH}" 2>/dev/null || true
git fetch origin main
git checkout main
git reset --hard "${COMMIT_SHA}"

# shellcheck disable=SC2086
if [[ "${STRATEGY}" == "pull" ]]; then
  docker compose ${COMPOSE_EXTRA} pull backend frontend
else
  docker compose ${COMPOSE_EXTRA} build backend frontend
fi
docker compose ${COMPOSE_EXTRA} up -d --force-recreate --remove-orphans backend frontend

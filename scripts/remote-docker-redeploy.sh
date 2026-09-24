#!/usr/bin/env bash
# Вызывается по SSH из GitHub Actions: git sync на заданный SHA и пересборка/перезапуск backend + frontend.
# Аргументы: REMOTE_PATH COMMIT_SHA STRATEGY [COMPOSE_EXTRA] [IMAGE_TAG]
# STRATEGY: build | pull  (для образов из GHCR нужен pull + IMAGE_TAG)
# COMPOSE_EXTRA: необязательные аргументы (например: -f docker-compose.prod.yml)
# IMAGE_TAG: опционально (например main-abc1234) — пишется в .env и export для compose pull/up
set -Eeuo pipefail

REMOTE_PATH="${1:?REMOTE_PATH required}"
COMMIT_SHA="${2:?COMMIT_SHA required}"
STRATEGY="${3:-pull}"
COMPOSE_EXTRA="${4:-}"
OPT_IMAGE_TAG="${5:-}"

if [[ "${STRATEGY}" != "build" && "${STRATEGY}" != "pull" ]]; then
  echo "STRATEGY must be build or pull" >&2
  exit 1
fi

cd "${REMOTE_PATH}"
git config --global --add safe.directory "${REMOTE_PATH}" 2>/dev/null || true
git fetch origin main
git checkout main
git reset --hard "${COMMIT_SHA}"

# Для compose с image: ghcr.io/...:${IMAGE_TAG} без обновления тега pull подтянет старые слои.
if [[ -n "${OPT_IMAGE_TAG}" ]]; then
  if [[ -f .env ]]; then
    if grep -qE '^IMAGE_TAG=' .env; then
      sed -i.bak "s/^IMAGE_TAG=.*/IMAGE_TAG=${OPT_IMAGE_TAG//\//\\/}/" .env
    else
      echo "IMAGE_TAG=${OPT_IMAGE_TAG}" >> .env
    fi
  else
    echo "IMAGE_TAG=${OPT_IMAGE_TAG}" > .env
  fi
  export IMAGE_TAG="${OPT_IMAGE_TAG}"
fi

# shellcheck disable=SC2086
if [[ "${STRATEGY}" == "pull" ]]; then
  docker compose ${COMPOSE_EXTRA} pull backend frontend
else
  docker compose ${COMPOSE_EXTRA} build backend frontend
fi
docker compose ${COMPOSE_EXTRA} up -d --force-recreate --remove-orphans backend frontend

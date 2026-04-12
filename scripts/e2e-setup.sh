#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> E2E: поднимаю docker compose (postgres, redis, migrator, backend)…"
docker compose -f docker-compose.e2e.yml up -d --build

echo "==> E2E: жду готовность backend (health)…"
for i in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:28000/api/v1/system/ready" >/dev/null 2>&1; then
    echo "Backend готов."
    break
  fi
  if [[ "$i" -eq 60 ]]; then
    echo "Таймаут ожидания backend." >&2
    docker compose -f docker-compose.e2e.yml ps >&2
    exit 1
  fi
  sleep 2
done

echo "==> E2E: заполняю каталог упражнений (seed_exercises)…"
docker compose -f docker-compose.e2e.yml exec -T backend sh -c "cd /app && python -m scripts.seed_exercises"

echo "==> E2E: окружение готово (API http://127.0.0.1:28000/api/v1)."

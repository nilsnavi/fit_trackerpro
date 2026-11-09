"""Live smoke-run of the FitTracker stack on http://localhost:18000 (dev compose).

Walks the golden path: Telegram auth for coach+client, coach profile,
invitation resolve/accept, packages (assign/consume/reverse), tasks,
and the WS2-3 stats check (active_days computed from real history).
"""
from __future__ import annotations

import os
import sys
from datetime import date

import httpx

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend"))
from app.tests.telegram_webapp import build_init_data  # noqa: E402

BASE = "http://localhost:18000/api/v1"
BOT_TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]
COACH_TG = int(os.environ.get("COACH_TG_ID", "900001"))
CLIENT_TG = int(os.environ.get("CLIENT_TG_ID", "900002"))

step = 0


def ok(label: str, detail: str = "") -> None:
    global step
    step += 1
    print(f"[{step:02d}] OK   {label} {detail}")


def fail(label: str, detail: str) -> None:
    print(f"[!!] FAIL {label} :: {detail}")
    raise SystemExit(1)


def main() -> None:
    c = httpx.Client(timeout=15)
    coach_init = build_init_data(
        bot_token=BOT_TOKEN, user={"id": COACH_TG, "first_name": "Coach", "username": "live_coach"}
    )
    client_init = build_init_data(
        bot_token=BOT_TOKEN, user={"id": CLIENT_TG, "first_name": "Client", "username": "live_client"}
    )

    r = c.post(f"{BASE}/users/auth/telegram", json={"init_data": coach_init})
    if r.status_code != 200:
        fail("coach auth", f"{r.status_code} {r.text[:200]}")
    coach = {"Authorization": f"Bearer {r.json()['access_token']}"}
    ok("coach auth (telegram initData -> JWT)")

    r = c.post(f"{BASE}/users/auth/telegram", json={"init_data": client_init})
    if r.status_code != 200:
        fail("client auth", f"{r.status_code} {r.text[:200]}")
    client = {"Authorization": f"Bearer {r.json()['access_token']}"}
    ok("client auth (telegram initData -> JWT)")

    # --- WS2-3: stats computed from real history ---
    seeded = os.popen(
        "docker exec fittracker-postgres psql -U fittracker -d fittracker -t -A -c "
        f"\"INSERT INTO workout_logs (user_id, date, duration, status, exercises, tags) SELECT u.id, CURRENT_DATE, 40, 'completed', '[]'::json, '[]'::json "
        f"FROM users u WHERE u.telegram_id = {CLIENT_TG} "
        f"AND NOT EXISTS (SELECT 1 FROM workout_logs w WHERE w.user_id = u.id AND w.date = CURRENT_DATE) "
        f"RETURNING id;\""
    ).read().strip()
    r = c.get(f"{BASE}/users/me/stats", headers=client)
    if r.status_code != 200:
        fail("stats", f"{r.status_code} {r.text[:200]}")
    stats = r.json()
    if "total_calories" in stats:
        fail("stats shape", "total_calories must not be present (WS2-3)")
    expected_active = int(
        os.popen(
            "docker exec fittracker-postgres psql -U fittracker -d fittracker -t -A -c "
            f"\"SELECT COUNT(DISTINCT wl.date) FROM workout_logs wl JOIN users u ON u.id = wl.user_id "
            f"WHERE u.telegram_id = {CLIENT_TG} AND wl.date >= CURRENT_DATE - INTERVAL '30 days';\""
        ).read().strip()
    )
    if stats["active_days"] != expected_active:
        fail("active_days", f"expected {expected_active}, got {stats['active_days']}")
    ok("WS2-3 stats", f"active_days={stats['active_days']} (history-backed, no total_calories; seeded_today={bool(seeded)})")

    # --- Coach requires the feature flag; check honest refusal first ---
    r = c.get(f"{BASE}/coach/profile", headers=coach)
    if r.status_code == 200:
        print("[..] coach flag already enabled — skipping disabled check")
    elif r.status_code in (403, 404, 503):
        ok("coach gated while flag disabled", f"HTTP {r.status_code}")
    else:
        fail("coach gate", f"unexpected {r.status_code} {r.text[:200]}")

    enabled = os.popen(
        "docker exec fittracker-postgres psql -U fittracker -d fittracker -t -A -c "
        "\"INSERT INTO feature_flags (key, enabled, description) VALUES ('coach', true, 'live run') "
        "ON CONFLICT (key) DO UPDATE SET enabled = true RETURNING enabled;\""
    ).read().splitlines()[0].strip()
    if enabled != "t":
        fail("enable coach flag", f"psql returned {enabled!r}")
    ok("feature flag 'coach' enabled")

    # --- Coach identity (Sprint 10.1) ---
    r = c.post(f"{BASE}/coach/profile", headers=coach, json={"display_name": "Live Coach", "bio": "live run"})
    if r.status_code == 409:
        # Re-runnable smoke: profile may exist from a previous run — read it back.
        r = c.get(f"{BASE}/coach/profile", headers=coach)
    if r.status_code not in (200, 201):
        fail("coach profile create", f"{r.status_code} {r.text[:200]}")
    profile = r.json()
    ok("coach profile ready", f"id={profile['id']}")
    r = c.get(f"{BASE}/coach/profile", headers=coach)
    if r.status_code != 200 or r.json()["display_name"] != "Live Coach":
        fail("coach profile get", f"{r.status_code} {r.text[:200]}")
    ok("coach profile read-back")

    # --- Invitation + accept (atomic) ---
    r = c.post(f"{BASE}/coach/invitations", headers=coach, json={"client_hint": "live client"})
    if r.status_code != 201:
        fail("invitation create", f"{r.status_code} {r.text[:200]}")
    token = r.json().get("token", "")
    if not token:
        fail("invitation token", "raw token missing")
    ok("invitation created", f"invitation_id={r.json()['id']} (raw token shown once)")

    r = c.post(f"{BASE}/coach/invitations/resolve", headers=client, json={"token": token})
    if r.status_code != 200:
        fail("invitation resolve", f"{r.status_code} {r.text[:200]}")
    resolved = r.json()
    ok("invitation resolved", f"coach={resolved['coach']['display_name']}")

    r = c.post(f"{BASE}/coach/invitations/accept", headers=client, json={"token": token})
    if r.status_code == 200:
        client_id = r.json()["client_id"]
        ok("invitation accepted", f"client_id={client_id}")
    elif r.status_code == 409:
        # Re-runnable smoke: an active coach-client relationship already exists.
        r = c.get(f"{BASE}/coach/clients", headers=coach)
        client_id = next(item["client_id"] for item in r.json())
        ok("coach-client already linked", f"client_id={client_id}")
    else:
        fail("invitation accept", f"{r.status_code} {r.text[:200]}")

    r = c.post(f"{BASE}/coach/invitations/accept", headers=client, json={"token": token})
    if r.status_code not in (409, 404):
        fail("invitation replay", f"expected 409/404, got {r.status_code}")
    ok("invitation replay rejected", f"HTTP {r.status_code}")

    r = c.get(f"{BASE}/coach/clients", headers=coach)
    if r.status_code != 200 or not any(item["client_id"] == client_id for item in r.json()):
        fail("coach clients list", f"{r.status_code} {r.text[:200]}")
    ok("coach sees client", f"clients={len(r.json())}")

    # --- Packages, consume, reverse (Sprint 10.4) ---
    r = c.post(
        f"{BASE}/coach/packages",
        headers=coach,
        json={"name": "Live 5-pack", "sessions_total": 5, "validity_days": 30, "price_amount": "5000.00", "currency": "RUB"},
    )
    if r.status_code != 201:
        fail("package template create", f"{r.status_code} {r.text[:200]}")
    package_id = r.json()["id"]
    ok("package template created", f"id={package_id}")

    r = c.post(f"{BASE}/coach/clients/{client_id}/packages", headers=coach, json={"package_id": package_id})
    if r.status_code != 201:
        fail("client package assign", f"{r.status_code} {r.text[:200]}")
    cp = r.json()
    if cp["sessions_remaining"] != 5:
        fail("client package balance", f"expected 5, got {cp['sessions_remaining']}")
    ok("package assigned to client", f"cp_id={cp['id']}, remaining={cp['sessions_remaining']}")

    consume_request_id = "-".join(["live", "consume", "1"])
    r = c.post(
        f"{BASE}/coach/clients/{client_id}/packages/{cp['id']}/consume",
        headers={**coach, "Idempotency-Key": consume_request_id}, json={},
    )
    if r.status_code != 200 or r.json()["sessions_used"] != 1:
        fail("consume", f"{r.status_code} {r.text[:200]}")
    ok("session consumed", "used=1, remaining=4")

    r = c.post(
        f"{BASE}/coach/clients/{client_id}/packages/{cp['id']}/consume",
        headers={**coach, "Idempotency-Key": consume_request_id}, json={},
    )
    if r.status_code != 409:
        fail("consume idempotency", f"expected 409, got {r.status_code}")
    ok("idempotent consume replay rejected", "HTTP 409")

    r = c.post(f"{BASE}/coach/clients/{client_id}/packages/{cp['id']}/reverse", headers=coach, json={"note": "live test"})
    if r.status_code != 200 or r.json()["sessions_used"] != 0:
        fail("reverse", f"{r.status_code} {r.text[:200]}")
    ok("session reversed", "used=0, remaining=5")

    r = c.get(f"{BASE}/coach/clients/{client_id}/packages/{cp['id']}", headers=coach)
    if r.status_code != 200 or len(r.json()["usage"]) < 2:
        fail("usage ledger", f"{r.status_code} {r.text[:200]}")
    ledger = r.json()["usage"]
    if sum(item["delta"] for item in ledger) != 0:
        fail("ledger balance", f"deltas sum {sum(item['delta'] for item in ledger)}")
    ok("usage ledger audited", f"entries={len(ledger)}, balance=0")

    # --- Payments ---
    r = c.post(f"{BASE}/coach/clients/{client_id}/payments", headers=coach, json={"amount": "5000.00", "method": "CARD"})
    if r.status_code != 201:
        fail("payment record", f"{r.status_code} {r.text[:200]}")
    payment_id = r.json()["id"]
    r = c.post(f"{BASE}/coach/clients/{client_id}/payments/{payment_id}/reverse", headers=coach)
    if r.status_code != 200 or r.json()["status"] != "REVERSED":
        fail("payment reverse", f"{r.status_code} {r.text[:200]}")
    r = c.post(f"{BASE}/coach/clients/{client_id}/payments/{payment_id}/reverse", headers=coach)
    if r.status_code != 409:
        fail("double reverse", f"expected 409, got {r.status_code}")
    r = c.get(f"{BASE}/coach/clients/{client_id}/payments", headers=coach)
    if len(r.json()) < 1:
        fail("payment history", "original row must be retained")
    ok("payment recorded + reversed once, history kept")

    # --- Tasks ---
    r = c.post(f"{BASE}/coach/tasks", headers=coach, json={"client_id": client_id, "title": "Live task", "priority": "HIGH"})
    if r.status_code != 201:
        fail("task create", f"{r.status_code} {r.text[:200]}")
    task_id = r.json()["id"]
    r = c.post(f"{BASE}/coach/tasks/{task_id}/complete", headers=coach)
    if r.status_code != 200 or r.json()["completed_at"] is None:
        fail("task complete", f"{r.status_code} {r.text[:200]}")
    r = c.delete(f"{BASE}/coach/tasks/{task_id}", headers=coach)
    if r.status_code != 204:
        fail("task delete", f"{r.status_code} {r.text[:200]}")
    ok("task created/completed/removed")

    # --- Object-level authorization (IDOR) ---
    other_init = build_init_data(
        bot_token=BOT_TOKEN, user={"id": 900003, "first_name": "Stranger", "username": "live_stranger"}
    )
    r = c.post(f"{BASE}/users/auth/telegram", json={"init_data": other_init})
    stranger = {"Authorization": f"Bearer {r.json()['access_token']}"}
    r = c.get(f"{BASE}/coach/clients/{client_id}", headers=stranger)
    if r.status_code != 404 and r.status_code != 403:
        fail("IDOR", f"expected 404/403 for foreign coach, got {r.status_code}")
    ok("foreign coach cannot read client", f"HTTP {r.status_code}")

    print(f"\nLIVE RUN PASSED: {step} checks")


if __name__ == "__main__":
    main()

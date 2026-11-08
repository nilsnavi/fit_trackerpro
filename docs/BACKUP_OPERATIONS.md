# Backup Operations

Регулярные резервные копии запускаются на production/staging хосте systemd timers, а не GitHub Actions. Это дополняет `scripts/backup_before_migrate.sh`: pre-migration backup остаётся plain SQL для rollback конкретного деплоя, регулярный backup создаёт custom archive PostgreSQL (`pg_dump -Fc`). Не смешивайте способы восстановления: plain SQL восстанавливается `psql`, archive восстанавливается `pg_restore`.

## Guarantees And Targets

| Metric | Target | Evidence |
|---|---:|---|
| RPO | <= 24 hours | daily archive must be present locally and offsite |
| RTO | <= 60 minutes | measure during the first production restore drill |
| Local retention | 7 daily / 4 weekly / 3 monthly | archive and SHA-256 sidecar in each tier |
| Restore verification | weekly | disposable database plus key-table counts |

`RTO` is a target until the timed staging and production drill has been recorded. Do not mark it as achieved from a script exit code alone.

## Install On The Host

Install the same committed revision that runs in `~/fittracker-pro`:

```bash
sudo install -d -m 0750 /usr/local/lib/fittracker /etc/fittracker /var/backups/fittracker-pro
sudo install -m 0750 scripts/backup_database.sh scripts/backup_restore_test.sh /usr/local/lib/fittracker/
sudo install -m 0644 ops/systemd/fittracker-*.service ops/systemd/fittracker-*.timer /etc/systemd/system/
```

Create `/etc/fittracker/backup.env` with mode `0600`, owned by the account that runs the units (normally `root`). This file is not committed and must contain real values:

```dotenv
FITTRACKER_REPO_ROOT=/home/<DEPLOY_USER>/fittracker-pro
COMPOSE_FILE=/home/<DEPLOY_USER>/fittracker-pro/docker-compose.prod.yml
BACKUPS_DIR=/var/backups/fittracker-pro
POSTGRES_USER=<production database user>
POSTGRES_DB=<production database name>
BACKUP_OFFSITE_TARGET=s3:<rclone-remote>/fittracker-pro
BACKUP_ALERT_WEBHOOK=https://hooks.slack.com/services/...
```

`rclone` must be configured for the root account used by systemd, for example with a restricted S3 credential. The target must be outside the production host/account. `BACKUP_ALERT_WEBHOOK` accepts a Slack-compatible incoming webhook; backup and restore failures are posted there. Configure storage retention/immutability on the remote independently of local rotation.

```bash
sudo chmod 0600 /etc/fittracker/backup.env
sudo systemctl daemon-reload
sudo systemctl enable --now fittracker-backup.timer fittracker-restore-test.timer
systemctl list-timers 'fittracker-*'
sudo systemctl start fittracker-backup.service
sudo systemctl start fittracker-restore-test.service
sudo journalctl -u fittracker-backup.service -u fittracker-restore-test.service --since today
```

The first restore test is deliberately run only after a successful backup. It creates and drops a database named `fittracker_restore_check_*`; it never writes to `POSTGRES_DB`.

## Verification

After the initial run and then weekly, verify both status files and the remote object. Values contain no credentials.

```bash
sudo cat /var/backups/fittracker-pro/status/last-backup.env
sudo cat /var/backups/fittracker-pro/status/last-restore-test.env
sudo find /var/backups/fittracker-pro/daily -maxdepth 1 -name '*.dump' -type f | wc -l
sudo find /var/backups/fittracker-pro/weekly -maxdepth 1 -name '*.dump' -type f | wc -l
sudo find /var/backups/fittracker-pro/monthly -maxdepth 1 -name '*.dump' -type f | wc -l
sudo -i rclone lsf 's3:<rclone-remote>/fittracker-pro/daily'
```

The weekly and monthly tiers become populated on Mondays and the first day of a month respectively. The acceptance condition of 7/4/3 applies after those timer boundaries have elapsed, not immediately after installation.

## Restore Drill Record

For each staging and production drill, record in the incident/operations log:

- archive timestamp and the resulting RPO;
- start/end timestamps and measured RTO;
- `last-restore-test.env` result;
- count checks for `alembic_version`, `users`, `workout_logs`, `workout_sets`, and `workout_session_exercises`;
- offsite object name and independent confirmation it is readable.

An alert delivery test is required: temporarily configure an invalid rclone target on staging, run `fittracker-backup.service`, and confirm the webhook alert before restoring the correct configuration.

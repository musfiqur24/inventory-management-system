#!/usr/bin/env bash
# Run from a systemd user timer; backup.env supplies encryption recipient/remote.
set -Eeuo pipefail
umask 077
state_dir="${PRODUCTION_STATE_DIR:-$HOME/.local/state/inventory-deploy}"
env_file="${PRODUCTION_ENV_FILE:-$HOME/.config/inventory/.env.production}"
compose_file="${PRODUCTION_COMPOSE_FILE:-$HOME/inventory-management-system/docker-compose.production.yml}"
: "${BACKUP_AGE_RECIPIENT:?Configure the off-server age recipient}"
: "${BACKUP_TARGET:?Configure an off-server rsync destination}"
for tool in docker age rsync tar; do command -v "$tool" >/dev/null || { echo "Missing $tool" >&2;exit 1; }; done
mkdir -p "$state_dir/backups"
exec 9>"$state_dir/deploy.lock"
flock -w 1800 9 || { echo 'Deployment lock timeout' >&2; exit 1; }
work="$(mktemp -d)"
trap 'rm -rf -- "$work"' EXIT
compose=(docker compose --project-name inventory-production --env-file "$env_file" -f "$compose_file")
"${compose[@]}" exec -T db pg_dump -U inventory -d inventory -Fc > "$work/database.dump"
"${compose[@]}" exec -T caddy tar czf - -C /data . > "$work/caddy-data.tar.gz"
cp -- "$env_file" "$work/production.env"
name="inventory-$(date -u +%Y%m%dT%H%M%SZ).tar.gz.age"
tar czf "$work/archive.tar.gz" -C "$work" database.dump caddy-data.tar.gz production.env
age -r "$BACKUP_AGE_RECIPIENT" -o "$state_dir/backups/$name" "$work/archive.tar.gz"
(cd "$state_dir/backups" && sha256sum "$name" > "$name.sha256")
rsync --archive -- "$state_dir/backups/$name" "$state_dir/backups/$name.sha256" "$BACKUP_TARGET"
printf '%s\n' "$(date -u +%FT%TZ) $name" > "$state_dir/last-offsite-backup"
# Retain encrypted local copies for 30 days; remote retention is configured remotely.
find "$state_dir/backups" -maxdepth 1 -type f \( -name '*.age' -o -name '*.age.sha256' \) -mtime +30 -delete
echo "Encrypted backup uploaded: $name"

#!/usr/bin/env bash
# Restore only into a new disposable PostgreSQL container; never production.
set -Eeuo pipefail
umask 077
archive="${1:?Usage: restore-check.sh backup.tar.gz.age age-private-key}"
identity="${2:?Provide the offline age private key file}"
work="$(mktemp -d)"
name="inventory-restore-check-$(date +%s)-$$"
cleanup(){ docker rm -f "$name" >/dev/null 2>&1 || true; rm -rf -- "$work"; }
trap cleanup EXIT
age --decrypt -i "$identity" -o "$work/archive.tar.gz" "$archive"
# Extract only the database dump; never unpack arbitrary paths from an archive.
tar xzf "$work/archive.tar.gz" -C "$work" database.dump
docker run -d --rm --name "$name" -e POSTGRES_USER=inventory -e POSTGRES_PASSWORD=restore-check -e POSTGRES_DB=inventory postgres:17-alpine@sha256:f9cf3e1f0066f0eb0c48707d864f0ac5941e9ff454a072077d97a4d278d07d73 >/dev/null
for attempt in $(seq 1 60); do
  if docker exec "$name" pg_isready -h 127.0.0.1 -U inventory >/dev/null 2>&1; then break; fi
  sleep 1
done
docker exec -i "$name" pg_restore -U inventory -d inventory --no-owner --no-acl --exit-on-error < "$work/database.dump"
project_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
docker exec -i "$name" psql -U inventory -d inventory -v ON_ERROR_STOP=1 < "$project_root/deploy/validate-restored-inventory.sql"
echo 'Restore rehearsal succeeded in a disposable database. Validate business totals against the backup manifest before recovery sign-off.'

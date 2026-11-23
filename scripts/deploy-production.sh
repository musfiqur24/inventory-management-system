#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

project_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
env_file="${PRODUCTION_ENV_FILE:-$HOME/.config/inventory/.env.production}"
state_dir="${PRODUCTION_STATE_DIR:-$HOME/.local/state/inventory-deploy}"

for command in docker flock curl; do
  command -v "$command" >/dev/null || { echo "Required command is missing: $command" >&2; exit 1; }
done
if [[ ! -f "$env_file" || ! -r "$env_file" ]]; then
  echo "Production env file is missing or unreadable: $env_file" >&2
  echo 'Copy your server .env.production to ~/.config/inventory/.env.production before enabling deployment.' >&2
  exit 1
fi
# Do not source the env file as shell code. Compose parses its contents.
mkdir -p "$state_dir/backups"
exec 9>"$state_dir/deploy.lock"
flock -n 9 || { echo 'Another production deployment is running.' >&2; exit 1; }
cd "$project_root"
compose=(docker compose --project-name inventory-production --env-file "$env_file" -f "$project_root/docker-compose.production.yml")

on_error() {
  echo 'Deployment failed. No automatic database restore was attempted.' >&2
  printf '%s\n' "${GITHUB_SHA:-manual}" > "$state_dir/failed-revision"
  echo "Database backups are stored in: $state_dir/backups" >&2
  "${compose[@]}" ps >&2 || true
}
trap on_error ERR

bash "$project_root/scripts/prepare-production-env.sh" "$env_file"
"${compose[@]}" config --quiet
# Finish all release builds before replacing any application containers.
if [[ -n "${INVENTORY_BACKEND_IMAGE:-}${INVENTORY_FRONTEND_IMAGE:-}${INVENTORY_MIGRATION_IMAGE:-}${INVENTORY_CADDY_IMAGE:-}${INVENTORY_DB_IMAGE:-}" ]]; then
  for image in "${INVENTORY_BACKEND_IMAGE:-}" "${INVENTORY_FRONTEND_IMAGE:-}" "${INVENTORY_MIGRATION_IMAGE:-}" "${INVENTORY_CADDY_IMAGE:-}" "${INVENTORY_DB_IMAGE:-}"; do
    [[ "$image" == *@sha256:* ]] || { echo 'Release images must use digests' >&2; exit 1; }
  done
  "${compose[@]}" pull backend frontend migrate caddy db
else
  "${compose[@]}" build backend frontend migrate caddy db
fi
"${compose[@]}" run --rm --no-deps caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
# Back up a running database before replacing even its minor-version image.
revision="${GITHUB_SHA:-manual}"
if [[ ! "$revision" =~ ^[a-zA-Z0-9_-]+$ ]]; then
  echo 'Invalid deployment revision.' >&2
  exit 1
fi
backup="$state_dir/backups/$(date -u +%Y%m%dT%H%M%SZ)-${revision:0:12}-$$.dump"
make_backup() {
  if ! "${compose[@]}" exec -T db pg_dump -U inventory -d inventory -Fc > "$backup.partial"; then
    rm -f -- "$backup.partial"
    echo 'Database backup failed; application containers were not replaced.' >&2
    exit 1
  fi
  mv -- "$backup.partial" "$backup"
  echo "Database backup saved: $backup"
}
running_db="$("${compose[@]}" ps --status running -q db)"
if [[ -n "$running_db" ]]; then make_backup; fi
"${compose[@]}" up -d --wait --wait-timeout 180 db
if [[ -z "$running_db" ]]; then make_backup; fi
"${compose[@]}" run --rm --no-deps migrate

# Recreate Nginx as well so it resolves the new backend container address.
# --no-deps keeps the healthy database running and preserves its volume.
"${compose[@]}" up -d --no-deps --force-recreate --wait --wait-timeout 180 backend frontend
# Start Caddy after the old frontend has released host port 80.
"${compose[@]}" up -d --no-deps --force-recreate --wait --wait-timeout 90 caddy
server_ip="$("${compose[@]}" exec -T caddy printenv SERVER_IP)"
server_ip="${server_ip//$'\r'/}"
if [[ ! "$server_ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo 'SERVER_IP must be an IPv4 address without a scheme, port, or spaces.' >&2
  exit 1
fi
# Trust this deployment's CA explicitly; never skip certificate verification.
root_cert="$state_dir/caddy-root.crt"
"${compose[@]}" exec -T caddy cat /data/caddy/pki/authorities/local/root.crt > "$root_cert.partial"
mv -- "$root_cert.partial" "$root_cert"
for endpoint in /api/v1/ready /; do
  curl --fail --silent --show-error --connect-timeout 5 --max-time 20 --retry 5 --retry-delay 3 --retry-connrefused \
    --noproxy '*' --cacert "$root_cert" \
    --connect-to "$server_ip:443:127.0.0.1:443" "https://$server_ip$endpoint" >/dev/null
done
if [[ -f "$state_dir/deployed-images" ]]; then cp -- "$state_dir/deployed-images" "$state_dir/previous-deployed-images"; fi
printf '%s\n' "$revision" > "$state_dir/deployed-revision"
printf '%s\n' "${INVENTORY_BACKEND_IMAGE:-local}" "${INVENTORY_FRONTEND_IMAGE:-local}" "${INVENTORY_MIGRATION_IMAGE:-local}" "${INVENTORY_CADDY_IMAGE:-local}" "${INVENTORY_DB_IMAGE:-local}" > "$state_dir/deployed-images"
rm -f -- "$state_dir/failed-revision"
echo "Production deployment succeeded: $revision"

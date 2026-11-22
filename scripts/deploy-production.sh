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
  echo "Database backups are stored in: $state_dir/backups" >&2
  "${compose[@]}" ps >&2 || true
}
trap on_error ERR

"${compose[@]}" config --quiet
# Finish both builds before replacing any application containers.
"${compose[@]}" pull caddy
"${compose[@]}" run --rm --no-deps caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
"${compose[@]}" build backend frontend
"${compose[@]}" up -d --wait --wait-timeout 180 db

# A completed dump is required before schema synchronization in backend startup.
revision="${GITHUB_SHA:-manual}"
if [[ ! "$revision" =~ ^[a-zA-Z0-9_-]+$ ]]; then
  echo 'Invalid deployment revision.' >&2
  exit 1
fi
backup="$state_dir/backups/$(date -u +%Y%m%dT%H%M%SZ)-${revision:0:12}-$$.dump"
if ! "${compose[@]}" exec -T db pg_dump -U inventory -d inventory -Fc > "$backup.partial"; then
  rm -f -- "$backup.partial"
  echo 'Database backup failed; application containers were not replaced.' >&2
  exit 1
fi
mv -- "$backup.partial" "$backup"
echo "Database backup saved: $backup"

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
for endpoint in /api/v1/health /; do
  curl --fail --silent --show-error --connect-timeout 5 --max-time 20 --retry 5 --retry-delay 3 --retry-connrefused \
    --noproxy '*' --cacert "$root_cert" \
    --connect-to "$server_ip:443:127.0.0.1:443" "https://$server_ip$endpoint" >/dev/null
done
echo "Production deployment succeeded: $revision"

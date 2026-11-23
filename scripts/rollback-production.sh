#!/usr/bin/env bash
# Restore app images only. A schema compatibility review is required first.
set -Eeuo pipefail
: "${ROLLBACK_SCHEMA_COMPATIBLE:?Review migration compatibility, then set ROLLBACK_SCHEMA_COMPATIBLE=yes}"
[[ "$ROLLBACK_SCHEMA_COMPATIBLE" == yes ]] || exit 1
state="${PRODUCTION_STATE_DIR:-$HOME/.local/state/inventory-deploy}"
env_file="${PRODUCTION_ENV_FILE:-$HOME/.config/inventory/.env.production}"
project_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
file="$state/deployed-images"
if [[ "${1:-}" == previous ]]; then file="$state/previous-deployed-images"; fi
[[ -f "$file" ]] || { echo 'No recorded release to restore' >&2;exit 1; }
mapfile -t images < "$file"
[[ "${images[0]}" == *@sha256:* && "${images[1]}" == *@sha256:* && "${images[2]:-}" == *@sha256:* && "${images[3]:-}" == *@sha256:* ]] || { echo 'Recorded release does not contain immutable image references' >&2;exit 1; }
exec 9>"$state/deploy.lock"
flock -n 9 || { echo 'Another deployment is running' >&2;exit 1; }
export INVENTORY_BACKEND_IMAGE="${images[0]}" INVENTORY_FRONTEND_IMAGE="${images[1]}" INVENTORY_MIGRATION_IMAGE="${images[2]}" INVENTORY_CADDY_IMAGE="${images[3]}"
# Keep the running database image; this rollback only changes application/proxy containers.
docker compose --project-name inventory-production --env-file "$env_file" -f "$project_root/docker-compose.production.yml" up -d --no-deps --force-recreate --wait --wait-timeout 180 backend frontend caddy
echo 'Application images restored. Database and migration history were not changed.'

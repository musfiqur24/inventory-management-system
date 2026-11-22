#!/usr/bin/env bash
# Exercise deployment ordering and failure handling without a real database.
set -Eeuo pipefail
script_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
test_dir="$(mktemp -d)"
trap 'rm -rf -- "$test_dir"' EXIT
mkdir -p "$test_dir/bin"
printf 'SERVER_IP=127.0.0.1\n' > "$test_dir/production.env"
cat > "$test_dir/bin/docker" <<'MOCK'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "$TRACE"
case "$*" in
  *'exec -T caddy printenv SERVER_IP'*) printf '10.10.252.50' ;;
  *'exec -T caddy cat '*) [[ "${FAIL_CERT:-0}" != 1 ]] || exit 1; printf 'mock-root-certificate' ;;
  *'build backend frontend'*) [[ "${FAIL_BUILD:-0}" != 1 ]] ;;
  *'exec -T db pg_dump'*) [[ "${FAIL_BACKUP:-0}" != 1 ]] || exit 1; printf 'mock-database-dump' ;;
  *) exit 0 ;;
esac
MOCK
cat > "$test_dir/bin/curl" <<'MOCK'
#!/usr/bin/env bash
printf 'https-health-check %s\n' "$*" >> "$TRACE"
[[ "${FAIL_HEALTH:-0}" != 1 ]]
MOCK
chmod +x "$test_dir/bin/docker" "$test_dir/bin/curl"
export PATH="$test_dir/bin:$PATH"
export PRODUCTION_ENV_FILE="$test_dir/production.env"
export PRODUCTION_STATE_DIR="$test_dir/state"
export TRACE="$test_dir/trace"
export GITHUB_SHA=1234567890abcdef

run_case() {
  : > "$TRACE"
  bash "$script_root/deploy-production.sh" > "$test_dir/output" 2>&1
}
run_case
[[ $(find "$PRODUCTION_STATE_DIR/backups" -name '*.dump' | wc -l) -eq 1 ]]
grep -q 'Production deployment succeeded' "$test_dir/output"
build_line=$(grep -n 'build backend frontend' "$TRACE" | cut -d: -f1)
backup_line=$(grep -n 'exec -T db pg_dump' "$TRACE" | cut -d: -f1)
update_line=$(grep -n 'up -d --no-deps --force-recreate.*backend frontend' "$TRACE" | cut -d: -f1)
(( build_line < backup_line && backup_line < update_line ))
grep -q 'https-health-check' "$TRACE"
grep -q -- '--cacert' "$TRACE"
grep -q 'https://10.10.252.50/api/v1/health' "$TRACE"
grep -q 'https://10.10.252.50/' "$TRACE"
! grep -Eq -- '--insecure|(^| )-k( |$)' "$TRACE"
[[ -s "$PRODUCTION_STATE_DIR/caddy-root.crt" ]]
! grep -Eq 'down|prune|--volumes|--accept-data-loss' "$TRACE"

export FAIL_BUILD=1
if run_case; then echo 'Build failure should stop deployment' >&2; exit 1; fi
! grep -q 'pg_dump\|up -d' "$TRACE"
unset FAIL_BUILD
export FAIL_BACKUP=1
if run_case; then echo 'Backup failure should stop deployment' >&2; exit 1; fi
! grep -q -- '--force-recreate' "$TRACE"
[[ $(find "$PRODUCTION_STATE_DIR/backups" -name '*.partial' | wc -l) -eq 0 ]]
unset FAIL_BACKUP
export FAIL_CERT=1
if run_case; then echo 'Missing certificate should fail deployment' >&2; exit 1; fi
! grep -q 'https-health-check' "$TRACE"
unset FAIL_CERT
export FAIL_HEALTH=1
if run_case; then echo 'Health failure should fail deployment' >&2; exit 1; fi
! grep -q 'Production deployment succeeded' "$test_dir/output"
unset FAIL_HEALTH
export PRODUCTION_ENV_FILE="$test_dir/missing.env"
if run_case; then echo 'Missing env should fail deployment' >&2; exit 1; fi
[[ ! -s "$TRACE" ]]
echo 'PASS: deployment order, backup preservation, build/backup/health failures, and missing env.'

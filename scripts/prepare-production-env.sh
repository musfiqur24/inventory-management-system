#!/usr/bin/env bash
# Add new, independent secrets without changing existing PostgreSQL/JWT passwords.
set -Eeuo pipefail
umask 077
env_file="${1:-$HOME/.config/inventory/.env.production}"
[[ -f "$env_file" ]] || { echo 'Production env file not found' >&2; exit 1; }
for key in APP_DB_PASSWORD MFA_ENCRYPTION_KEY; do
  if ! grep -Eq "^${key}=.+" "$env_file"; then
    command -v openssl >/dev/null || { echo 'Install openssl to generate new deployment secrets' >&2;exit 1; }
    value="$(openssl rand -hex 32)"
    # Remove an empty template entry before appending; never print secret values.
    sed -i "/^${key}=$/d" "$env_file"
    printf '\n%s=%s\n' "$key" "$value" >> "$env_file"
  fi
done
chmod 600 "$env_file"
echo 'Production settings contain independent app-database and MFA encryption secrets.'

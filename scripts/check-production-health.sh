#!/usr/bin/env bash
set -Eeuo pipefail
state="${PRODUCTION_STATE_DIR:-$HOME/.local/state/inventory-deploy}"
if [[ ! -f "$state/last-offsite-backup" ]] || [[ -n "$(find "$state/last-offsite-backup" -mmin +1560 -print)" ]]; then
  echo 'ALERT: no successful offsite backup within 26 hours' >&2; exit 1
fi
curl --fail --silent --show-error --cacert "$state/caddy-root.crt" --max-time 10 "${INVENTORY_READY_URL:?Set INVENTORY_READY_URL}" >/dev/null
df -Pk "$state" | awk 'NR==2 {if ($5+0>=85) {print "ALERT: filesystem usage " $5; exit 1}}'
echo 'Health and backup freshness checks passed'

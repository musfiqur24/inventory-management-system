#!/usr/bin/env bash
set -Eeuo pipefail
mkdir -p "$HOME/.local/lib/inventory" "$HOME/.config/systemd/user"
project_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
install -m 700 "$project_root/scripts/backup-production.sh" "$HOME/.local/lib/inventory/backup-production.sh"
install -m 600 "$project_root/deploy/systemd/inventory-backup.service" "$HOME/.config/systemd/user/"
install -m 600 "$project_root/deploy/systemd/inventory-backup.timer" "$HOME/.config/systemd/user/"
if [[ ! -f "$HOME/.config/inventory/backup.env" ]]; then
  install -m 600 "$project_root/deploy/backup.env.example" "$HOME/.config/inventory/backup.env"
  echo 'Configure ~/.config/inventory/backup.env before starting the timer.'
fi
systemctl --user daemon-reload
echo 'After configuring backup.env and installing age/rsync, run: systemctl --user enable --now inventory-backup.timer'

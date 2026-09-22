#!/bin/bash
# Turns the Bluetooth radio on or off — see app/utils/system-control.server.ts (Settings ->
# Devices' Bluetooth toggle). No `rfkill` binary on this image, so this stops/starts bluetoothd
# itself: stopping it drops the HCI device out of BlueZ's control (no scanning, no advertising,
# nothing pairs), and starting it brings the adapter back up the same way a fresh boot would.
set -euo pipefail

case "${1:-}" in
  on) systemctl enable --now bluetooth.service ;;
  off) systemctl disable --now bluetooth.service ;;
  *)
    echo "Usage: $0 on|off" >&2
    exit 1
    ;;
esac

#!/bin/bash
# Turns the Bluetooth radio on or off — see app/utils/system-control.server.ts (Settings ->
# Devices' Bluetooth toggle). Tilt scanning is the only thing this app does over Bluetooth, and it
# talks to the controller directly over raw HCI (tilt-ble.service, which Conflicts=bluetooth.service
# in its unit file specifically to keep BlueZ from holding the device) — so "the Bluetooth radio" and
# "Tilt scanning" are the same on/off switch here, not two independent things. Enabling this starts
# scanning immediately; disabling it drops the radio and Tilt readings go stale.
set -euo pipefail

case "${1:-}" in
  on) systemctl enable --now tilt-ble.service ;;
  off) systemctl disable --now tilt-ble.service ;;
  *)
    echo "Usage: $0 on|off" >&2
    exit 1
    ;;
esac

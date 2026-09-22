#!/bin/bash
# Turns the Wi-Fi CLIENT radio (the internet uplink) on or off — NOT the access point radio, which
# must keep working for PicoBrew devices to pair regardless of this toggle. See
# app/utils/system-control.server.ts (Settings -> Wi-Fi's radio toggle).
#
# Uses `nmcli device set managed` rather than `nmcli radio wifi` (a single global kill-switch
# covering every Wi-Fi device, AP included) or `rfkill` (not installed on this image), and targets
# the client radio dynamically via wifi-radios.sh rather than a hardcoded interface name.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./wifi-radios.sh
source "$SCRIPT_DIR/wifi-radios.sh"

radio="$(client_radio)"
if [ -z "$radio" ]; then
  echo "No client Wi-Fi radio found (single-radio Pi?)" >&2
  exit 1
fi

case "${1:-}" in
  on) nmcli device set "$radio" managed yes ;;
  off) nmcli device set "$radio" managed no ;;
  status)
    if nmcli -t -f GENERAL.STATE device show "$radio" 2>/dev/null | grep -q 'unmanaged'; then
      echo off
    else
      echo on
    fi
    ;;
  *)
    echo "Usage: $0 on|off|status" >&2
    exit 1
    ;;
esac

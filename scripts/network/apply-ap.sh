#!/bin/bash
# Sets the PICOBREW access point's SSID/passphrase via NetworkManager's hotspot mode (setup-nm-ap.sh).
# Baked into the image; invoked via passwordless sudo from network-control.server.ts.
set -euo pipefail

SSID="${1:-}"
PASSWORD="${2:-}"

# Reject control characters (in particular newlines) outright: this value is written verbatim into
# NetworkManager's connection profile, and argv passed via execFile (see network-control.server.ts) never goes
# through a shell, so a newline here isn't a shell-injection risk — but it WOULD let a value smuggle
# an extra setting into the profile if we didn't check for it.
if [[ -z "$SSID" || ${#SSID} -gt 32 || "$SSID" =~ [[:cntrl:]] ]]; then
  echo "Invalid SSID: must be 1-32 characters, no control characters" >&2
  exit 1
fi
if [[ ${#PASSWORD} -lt 8 || ${#PASSWORD} -gt 63 || "$PASSWORD" =~ [[:cntrl:]] ]]; then
  echo "Invalid password: WPA2 requires 8-63 characters, no control characters" >&2
  exit 1
fi

if ! command -v nmcli >/dev/null 2>&1 || ! systemctl is-active --quiet NetworkManager; then
  echo "NetworkManager is not running; RePicoBrew needs Raspberry Pi OS Bookworm or newer" >&2
  exit 1
fi
exec "$(dirname "$0")/setup-nm-ap.sh" "$SSID" "$PASSWORD"

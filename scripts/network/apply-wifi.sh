#!/bin/bash
# Joins the home Wi-Fi network with a second radio (a USB Wi-Fi dongle) through NetworkManager; the
# built-in radio is dedicated to the access point (see setup-nm-ap.sh). Baked into the image; invoked via passwordless sudo from network-control.server.ts, which then polls
# for real internet connectivity (app/utils/wifi.server.ts's checkInternetConnectivity) before
# telling the caller (Setup wizard / Settings) that Wi-Fi actually works — not just that a
# name/password pair got saved to a database table, which is all this used to do.
set -euo pipefail

SSID="${1:-}"
PASSWORD="${2:-}"

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

# shellcheck source=wifi-radios.sh
source "$(dirname "$0")/wifi-radios.sh"
CLIENT_IF="$(client_radio)"
if [ -z "$CLIENT_IF" ]; then
  echo "NetworkManager system with a single Wi-Fi radio: client join skipped (internet comes from the wired uplink)" >&2
  exit 0
fi
CLIENT_MAC="$(radio_mac "$CLIENT_IF")"
CON_NAME="repicobrew-home"
# Replace any previous profile of ours; if the new one can't connect, drop it again so NetworkManager falls
# back to whatever network the dongle was on before (e.g. the one from the first-boot setup).
nmcli connection delete "$CON_NAME" >/dev/null 2>&1 || true
nmcli connection add type wifi con-name "$CON_NAME" autoconnect yes connection.autoconnect-priority 20 \
  ssid "$SSID" 802-11-wireless.mac-address "$CLIENT_MAC" 802-11-wireless.band bg \
  wifi-sec.key-mgmt wpa-psk wifi-sec.psk "$PASSWORD" ipv6.method ignore >/dev/null
if ! nmcli --wait 30 connection up "$CON_NAME" ifname "$CLIENT_IF" >/dev/null 2>&1; then
  nmcli connection delete "$CON_NAME" >/dev/null 2>&1 || true
  echo "Could not join \"$SSID\" on $CLIENT_IF (wrong password, or out of range)" >&2
  exit 1
fi
exit 0

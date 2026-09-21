#!/bin/bash
# Writes a wpa_supplicant network block for `wlan0` (the physical radio, now a normal DHCP client —
# see create-uap0.sh for why the AP moved off it) and restarts dhcpcd so it re-associates. Baked
# into the image; invoked via passwordless sudo from network-control.server.ts, which then polls
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

# NetworkManager-based OS (e.g. a Pi 4): the built-in radio is dedicated to the access point (see
# setup-nm-ap.sh). If a second radio is present (a USB Wi-Fi dongle), it joins the home network here;
# with only one radio there is nothing to join with and internet comes from the wired uplink instead.
if command -v nmcli >/dev/null 2>&1 && systemctl is-active --quiet NetworkManager; then
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
fi

CONF=/etc/wpa_supplicant/wpa_supplicant.conf
{
  echo "ctrl_interface=DIR=/var/run/wpa_supplicant GROUP=netdev"
  echo "update_config=1"
  # Reasonable default regulatory domain so the radio associates at all; a wrong one only affects
  # available channels/transmit power, not whether this script itself succeeds. Not exposed as a
  # setting yet — a real follow-up if this is ever used outside the US.
  echo "country=US"
  # wpa_passphrase escapes/quotes the SSID and stores a PSK hash rather than the plaintext password
  # — safer than hand-building this block, and its own argument handling is what actually protects
  # against SSIDs containing characters that would otherwise be awkward to embed in a config file.
  wpa_passphrase "$SSID" "$PASSWORD" | grep -v '^[[:space:]]*#psk='
} > "$CONF"
chmod 600 "$CONF"

systemctl restart dhcpcd

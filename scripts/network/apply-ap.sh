#!/bin/bash
# Rewrites hostapd's SSID/passphrase for the PICOBREW access point and restarts hostapd to apply.
# The AP now lives on the virtual `uap0` interface (see scripts/network/create-uap0.sh) instead of
# the physical `wlan0` radio, which is freed up to join the user's home Wi-Fi as a normal client
# (see apply-wifi.sh) — the Pi Zero W has only one physical radio, so both roles can't share it.
# Baked into the image; invoked via passwordless sudo from network-control.server.ts.
set -euo pipefail

SSID="${1:-}"
PASSWORD="${2:-}"

# Reject control characters (in particular newlines) outright: this value is written verbatim into
# hostapd.conf below, and argv passed via execFile (see network-control.server.ts) never goes
# through a shell, so a newline here isn't a shell-injection risk — but it WOULD let a value smuggle
# an extra config line into hostapd.conf if we didn't check for it.
if [[ -z "$SSID" || ${#SSID} -gt 32 || "$SSID" =~ [[:cntrl:]] ]]; then
  echo "Invalid SSID: must be 1-32 characters, no control characters" >&2
  exit 1
fi
if [[ ${#PASSWORD} -lt 8 || ${#PASSWORD} -gt 63 || "$PASSWORD" =~ [[:cntrl:]] ]]; then
  echo "Invalid password: WPA2 requires 8-63 characters, no control characters" >&2
  exit 1
fi

# NetworkManager-based OS (Bookworm/Trixie, e.g. a Pi 4 on Ethernet): no hostapd/dhcpcd here, so
# use NetworkManager's hotspot mode instead.
if command -v nmcli >/dev/null 2>&1 && systemctl is-active --quiet NetworkManager; then
  exec "$(dirname "$0")/setup-nm-ap.sh" "$SSID" "$PASSWORD"
fi

CONF=/etc/hostapd/hostapd.conf
# The AP must share wlan0's channel while wlan0 is joined to a network (see sync-ap-channel.sh);
# fall back to 7 when it isn't.
CHANNEL="$(iw dev wlan0 info 2>/dev/null | awk '/channel/ {print $2; exit}')"
CHANNEL="${CHANNEL:-7}"
{
  echo "# RePicoBrew AP - hostapd configuration"
  echo "interface=uap0"
  echo "driver=nl80211"
  printf 'ssid=%s\n' "$SSID"
  echo "hw_mode=g"
  echo "channel=$CHANNEL"
  echo "wmm_enabled=0"
  echo "macaddr_acl=0"
  echo "auth_algs=1"
  echo "ignore_broadcast_ssid=0"
  echo "wpa=2"
  printf 'wpa_passphrase=%s\n' "$PASSWORD"
  echo "wpa_key_mgmt=WPA-PSK"
  echo "wpa_pairwise=TKIP"
  echo "rsn_pairwise=CCMP"
} > "$CONF"

systemctl restart hostapd

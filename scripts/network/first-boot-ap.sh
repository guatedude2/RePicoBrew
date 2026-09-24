#!/bin/bash
# First-boot setup for the RePicoBrew Raspberry Pi image (NetworkManager-based Raspberry Pi OS): sets the Wi-Fi
# regulatory country (Raspberry Pi OS keeps Wi-Fi blocked until one is set), unblocks Wi-Fi, and creates the
# default PICOBREW access point. Run once by repicobrew-first-boot.service, which is skipped from then on
# because this leaves the picobrew-ap connection behind. The AP name/password can be changed later in Settings.
#
# The AP can't be created while building the image (no NetworkManager or radio in a chroot), which is why this
# runs on the Pi's first boot instead.
set -euo pipefail

SSID="${AP_SSID:-PICOBREW}"
PASSWORD="${AP_PASSWORD:-picobrew123}"
COUNTRY="${WIFI_COUNTRY:-US}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./wifi-radios.sh
source "$DIR/wifi-radios.sh"

if command -v raspi-config >/dev/null 2>&1; then
  raspi-config nonint do_wifi_country "$COUNTRY" || true
else
  iw reg set "$COUNTRY" || true
fi
rfkill unblock wifi || true

# The radio's driver can still be loading right after boot.
for _ in $(seq 1 60); do
  [ -n "$(ap_radio)" ] && break
  sleep 1
done
if [ -z "$(ap_radio)" ]; then
  echo "No Wi-Fi radio found" >&2
  exit 1
fi

exec "$DIR/setup-nm-ap.sh" "$SSID" "$PASSWORD"

#!/bin/bash
# Recovers the client Wi-Fi radio (the USB dongle providing internet — see wifi-radios.sh) when it
# silently drops off. Seen twice in one session on this hardware (a Realtek RTL8188CUS/rtl8192cu
# adapter): once as "AP off, try to reconnect now" (the driver noticing the AP vanished) and once as
# "deauthenticating ... by local choice" (NetworkManager itself giving up), neither of which the
# driver/NetworkManager recovers from on their own — the interface is left DOWN indefinitely. A plain
# `ip link set up` doesn't help either; only a full USB unbind/rebind (forcing the driver to reload
# and reassociate) has fixed it so far. This is a known real-world flakiness of this driver, not a
# misconfiguration — the correct in-kernel driver is already in use.
#
# Run periodically by wlan1-watchdog.service (a systemd timer). `--once` does a single check and exits.
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./wifi-radios.sh
source "$SCRIPT_DIR/wifi-radios.sh"

CON_NAME="repicobrew-home"

check_once() {
  local radio
  radio="$(client_radio)"
  if [ -z "$radio" ]; then
    return 0 # single-radio Pi: no client radio to watch
  fi
  if ! is_usb_radio "$radio"; then
    return 0 # the unbind/rebind recovery only applies to a USB radio
  fi
  # Deliberately turned off via Settings -> Wi-Fi's radio toggle (wifi-client-radio.sh sets this) —
  # respect it; don't fight the user's own choice by "recovering" a radio they turned off on purpose.
  if nmcli -t -f GENERAL.STATE device show "$radio" 2>/dev/null | grep -q 'unmanaged'; then
    return 0
  fi

  # Up and holding a default route: healthy, nothing to do.
  if ip link show "$radio" | grep -q ' UP ' && ip route show dev "$radio" | grep -q '^default'; then
    return 0
  fi

  echo "[wlan1-watchdog] $radio is down or routeless; recovering..."

  # Resolve the radio's USB device path (e.g. /sys/bus/usb/devices/1-1.1:1.0 -> busid 1-1.1) so this
  # doesn't hardcode a physical port that could change if the dongle moves to a different port/hub.
  local dev_path busid
  dev_path="$(readlink -f "/sys/class/net/$radio/device" 2>/dev/null)"
  busid="$(basename "$dev_path")"
  busid="${busid%%:*}"
  if [ -z "$busid" ] || [ ! -e "/sys/bus/usb/devices/$busid" ]; then
    echo "[wlan1-watchdog] could not resolve a USB busid for $radio; skipping recovery"
    return 1
  fi

  echo "$busid" > /sys/bus/usb/drivers/usb/unbind 2>/dev/null
  sleep 2
  echo "$busid" > /sys/bus/usb/drivers/usb/bind 2>/dev/null
  sleep 5

  # The driver reload doesn't always trigger NetworkManager to reassociate on its own.
  if ! ip route show dev "$radio" 2>/dev/null | grep -q '^default'; then
    nmcli connection up "$CON_NAME" ifname "$radio" >/dev/null 2>&1
  fi
}

if [ "${1:-}" = "--once" ]; then
  check_once
  exit 0
fi

while true; do
  check_once
  sleep 60
done

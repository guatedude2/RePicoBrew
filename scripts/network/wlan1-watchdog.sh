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
# This adapter also fails while still looking connected: the link stays UP with a route, but most packets (large
# ones first) are lost, or none get through at all. So "healthy" means the router actually answers pings through the
# radio, both small and full-size ones; after FAILS_BEFORE_RESET bad checks in a row the radio is reset.
#
# Runs as wlan1-watchdog.service, checking every CHECK_INTERVAL seconds. `--once` does a single check and exits.
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./wifi-radios.sh
source "$SCRIPT_DIR/wifi-radios.sh"

CHECK_INTERVAL=30
FAILS_BEFORE_RESET=3
# Never reset more often than this, so a router outage doesn't turn into a constant reset loop.
MIN_SECONDS_BETWEEN_RESETS=300

fails=0
last_reset=0
# Some routers ignore pings, so the link is only judged by pings once the router has answered one. That's remembered
# on disk per router address, so a link that's already dead when this starts (e.g. after a reboot) still gets reset.
STATE_DIR="${STATE_DIR:-/var/lib/repicobrew}"

# How many of `count` pings of `size` bytes the gateway answered through `radio`.
ping_replies() {
  local radio="$1" gateway="$2" size="$3" count="$4"
  ping -I "$radio" -c "$count" -W 2 -s "$size" -q "$gateway" 2>/dev/null |
    awk '/packets transmitted/ { print $4; found=1 } END { if (!found) print 0 }'
}

link_is_healthy() {
  local radio="$1" gateway small large
  ip link show "$radio" | grep -q ' UP ' || return 1
  gateway="$(ip route show default dev "$radio" 2>/dev/null | awk '{ print $3; exit }')"
  [ -n "$gateway" ] || return 1

  local known="$STATE_DIR/gateway-answers-pings-$gateway"
  small="$(ping_replies "$radio" "$gateway" 56 3)"
  if [ "$small" -gt 0 ]; then
    [ -e "$known" ] || { mkdir -p "$STATE_DIR" && touch "$known"; }
  elif [ -e "$known" ]; then
    echo "[wlan1-watchdog] $radio: no replies from $gateway"
    return 1
  else
    return 0 # gateway has never answered a ping; nothing more to test
  fi
  # Full-size packets are what this adapter loses first; at least half must get through.
  large="$(ping_replies "$radio" "$gateway" 1200 4)"
  if [ "$large" -lt 2 ]; then
    echo "[wlan1-watchdog] $radio: only $large of 4 full-size pings to $gateway answered"
    return 1
  fi
  return 0
}

reset_radio() {
  local radio="$1" dev_path busid
  # Resolve the radio's USB device path (e.g. /sys/bus/usb/devices/1-1.1:1.0 -> busid 1-1.1) so this doesn't
  # hardcode a physical port that could change if the dongle moves to a different port/hub.
  dev_path="$(readlink -f "/sys/class/net/$radio/device" 2>/dev/null)"
  busid="$(basename "$dev_path")"
  busid="${busid%%:*}"
  if [ -z "$busid" ] || [ ! -e "/sys/bus/usb/devices/$busid" ]; then
    echo "[wlan1-watchdog] could not resolve a USB busid for $radio; skipping recovery"
    return 1
  fi
  echo "[wlan1-watchdog] resetting $radio (USB $busid)..."
  echo "$busid" >/sys/bus/usb/drivers/usb/unbind 2>/dev/null
  sleep 2
  echo "$busid" >/sys/bus/usb/drivers/usb/bind 2>/dev/null
  sleep 5
  # The driver reload doesn't always make NetworkManager reassociate on its own. `device connect` uses whichever
  # saved network suits this radio (the home network from first-boot setup, or the one chosen in Settings).
  local new_radio
  new_radio="$(client_radio)"
  [ -n "$new_radio" ] && nmcli --wait 30 device connect "$new_radio" >/dev/null 2>&1
  return 0
}

check_once() {
  local radio now
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
    fails=0
    return 0
  fi

  if link_is_healthy "$radio"; then
    fails=0
    return 0
  fi
  fails=$((fails + 1))
  if [ "$fails" -lt "$FAILS_BEFORE_RESET" ]; then
    return 0
  fi
  now="$(date +%s)"
  if [ $((now - last_reset)) -lt "$MIN_SECONDS_BETWEEN_RESETS" ]; then
    return 0
  fi
  echo "[wlan1-watchdog] $radio unhealthy for $fails checks in a row; recovering..."
  reset_radio "$radio"
  last_reset="$(date +%s)"
  fails=0
}

if [ "${1:-}" = "--once" ]; then
  FAILS_BEFORE_RESET=1
  check_once
  exit 0
fi

while true; do
  check_once
  sleep "$CHECK_INTERVAL"
done

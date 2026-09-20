#!/bin/bash
# Keeps the PICOBREW access point on the same Wi-Fi channel as the Pi's own client connection.
#
# The Pi Zero W has ONE physical radio shared by wlan0 (joined to the home network) and uap0 (the
# access point), and that chip can only run both on the same channel. Once wlan0 associates on a
# channel other than hostapd.conf's fixed one, the AP gets torn down: hostapd still reports
# "active" but uap0 goes DOWN and the SSID disappears (confirmed on real hardware: home router on
# channel 6, AP configured for 7). So follow the client: whenever wlan0 is associated on a different
# channel, rewrite hostapd.conf's channel and restart hostapd. Also covers the home router later
# changing channels. With no client connection, the configured channel is left alone.
#
# Run by repicobrew-ap-channel.service (loops); `--once` does a single check and exits.
set -u

CONF=/etc/hostapd/hostapd.conf

sta_channel() {
  iw dev wlan0 info 2>/dev/null | awk '/channel/ {print $2; exit}'
}

sync_once() {
  local sta cur
  sta="$(sta_channel)"
  [ -n "$sta" ] || return 0
  cur="$(sed -n 's/^channel=//p' "$CONF")"
  if [ "$sta" != "$cur" ]; then
    sed -i "s/^channel=.*/channel=$sta/" "$CONF"
    systemctl restart hostapd
  fi
}

if [ "${1:-}" = "--once" ]; then
  sync_once
  exit 0
fi

while true; do
  sync_once
  sleep 10
done

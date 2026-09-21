#!/bin/bash
# Creates (or replaces) the PICOBREW access point on a NetworkManager-based Raspberry Pi OS
# (Bookworm/Trixie), where the hostapd + dhcpcd scripts written for the Zero W image don't apply.
# Uses NetworkManager's own hotspot mode: `ipv4.method shared` runs a private dnsmasq for DHCP/DNS
# on the AP subnet and NATs it out through whatever uplink the Pi has (Ethernet on a Pi 4).
#
# Meant for a Pi with a wired uplink — wlan0 is dedicated to the AP here, so any Wi-Fi client
# connection on it is dropped. Called by apply-ap.sh; can also be run by hand:
#   sudo scripts/network/setup-nm-ap.sh <ssid> <password>
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

CON_NAME="picobrew-ap"
AP_IP="192.168.72.1"

# NetworkManager's shared-mode dnsmasq reads this directory. Same DNS spoof the hostapd setup uses:
# the PicoBrew devices look up picobrew.com and must land on this Pi.
mkdir -p /etc/NetworkManager/dnsmasq-shared.d
cat > /etc/NetworkManager/dnsmasq-shared.d/picobrew.conf <<EOF
address=/picobrew.com/$AP_IP
address=/www.picobrew.com/$AP_IP
EOF

# Picks the quietest of the non-overlapping 2.4GHz channels (1, 6, 11) by scanning for neighbouring
# networks and summing their signal power on each (weighted down for adjacent-channel overlap). Auto
# channel selection in NetworkManager is not reliable here: it settled on channel 6 next to a strong
# neighbour, and the Pico C (a weak, 2.4GHz-only client that never retransmits a lost TCP segment)
# then dropped requests mid-stream and reported error 7. Falls back to channel 1 if the scan fails.
pick_channel() {
  local iw_bin
  iw_bin="$(command -v iw || true)"
  if [ -z "$iw_bin" ]; then
    echo 1
    return
  fi
  "$iw_bin" dev wlan0 scan 2>/dev/null | awk '
    function flush(   ch, i, t, d) {
      if (f != "" && s != "" && f < 2500) {
        ch = int((f - 2407) / 5)
        for (i = 1; i <= 3; i++) {
          t = tgt[i]; d = ch - t; if (d < 0) d = -d
          if (d <= 4) score[t] += (10 ^ ((s + 100) / 10)) * (1 - d * 0.2)
        }
      }
      f = ""; s = ""
    }
    BEGIN { tgt[1] = 1; tgt[2] = 6; tgt[3] = 11 }
    /^BSS/ { flush() }
    /freq:/ { f = $2 }
    /signal:/ { s = $2 }
    END {
      flush()
      best = 1
      for (i = 2; i <= 3; i++) if (score[tgt[i]] < score[best]) best = tgt[i]
      print best
    }
  ' || echo 1
}
CHANNEL="$(pick_channel)"
CHANNEL="${CHANNEL:-1}"
echo "Using 2.4GHz channel $CHANNEL"

nmcli connection delete "$CON_NAME" >/dev/null 2>&1 || true
# SSID/password go to nmcli as separate arguments (no shell), so any characters are safe. The high
# autoconnect priority makes this win over any Wi-Fi client profile on wlan0 at boot.
nmcli connection add type wifi ifname wlan0 con-name "$CON_NAME" autoconnect yes ssid "$SSID" \
  802-11-wireless.mode ap 802-11-wireless.band bg 802-11-wireless.channel "$CHANNEL" \
  802-11-wireless.powersave 2 \
  wifi-sec.key-mgmt wpa-psk wifi-sec.psk "$PASSWORD" \
  ipv4.method shared ipv4.addresses "$AP_IP/24" ipv6.method ignore \
  connection.autoconnect-priority 100
nmcli connection up "$CON_NAME"

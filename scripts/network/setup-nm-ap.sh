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

nmcli connection delete "$CON_NAME" >/dev/null 2>&1 || true
# SSID/password go to nmcli as separate arguments (no shell), so any characters are safe. The high
# autoconnect priority makes this win over any Wi-Fi client profile on wlan0 at boot.
nmcli connection add type wifi ifname wlan0 con-name "$CON_NAME" autoconnect yes ssid "$SSID" \
  802-11-wireless.mode ap 802-11-wireless.band bg \
  wifi-sec.key-mgmt wpa-psk wifi-sec.psk "$PASSWORD" \
  ipv4.method shared ipv4.addresses "$AP_IP/24" ipv6.method ignore \
  connection.autoconnect-priority 100
nmcli connection up "$CON_NAME"

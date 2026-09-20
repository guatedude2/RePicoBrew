#!/bin/bash
# Creates the virtual `uap0` AP interface at boot, freeing wlan0 (the Pi Zero W's only physical
# radio) to join the home network as a normal Wi-Fi client while uap0 keeps hosting the PICOBREW
# access point for pairing brewing hardware. Run once at boot by create-uap0.service, before
# hostapd starts (hostapd.conf now targets uap0 — see scripts/network/apply-ap.sh and
# scripts/setup-pi-ap.sh).
set -e

# wlan0 needs to exist before we can add a virtual interface on top of it — on a fresh boot this
# can lag slightly behind this unit starting.
for _ in $(seq 1 30); do
  ip link show wlan0 &>/dev/null && break
  sleep 1
done

if ! ip link show uap0 &>/dev/null; then
  iw dev wlan0 interface add uap0 type __ap
fi
ip link set uap0 up

# NAT so devices connected to the PICOBREW AP (and the Pi's own traffic, which already routes out
# wlan0 directly once it's joined a network) can reach the internet through wlan0's uplink.
# ip_forward=1 is already set via /etc/sysctl.conf by scripts/setup-pi-ap.sh.
iptables -t nat -C POSTROUTING -o wlan0 -j MASQUERADE 2>/dev/null || \
  iptables -t nat -A POSTROUTING -o wlan0 -j MASQUERADE

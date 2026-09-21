#!/bin/bash
# Helpers for telling a Pi's Wi-Fi radios apart, sourced by the other network scripts.
#
# With two radios (the built-in one plus a USB dongle) the roles are fixed: the BUILT-IN radio hosts the
# access point the PicoBrew devices join (so nothing else ever scans, joins or changes channel on it), and
# a USB radio is the client that joins the home network for internet. Names like wlan0/wlan1 can swap at
# boot, so callers bind NetworkManager profiles to a radio's hardware (MAC) address, not its name.

# Names of all Wi-Fi radios.
wifi_interfaces() {
  local d
  for d in /sys/class/net/*/wireless; do
    [ -d "$d" ] && basename "$(dirname "$d")"
  done
}

# True if the radio sits on the USB bus.
is_usb_radio() {
  [[ "$(readlink -f "/sys/class/net/$1/device/subsystem" 2>/dev/null)" == */usb ]]
}

# The radio that hosts the access point: the first non-USB radio, or the first radio if all are USB.
ap_radio() {
  local i first=""
  for i in $(wifi_interfaces); do
    [ -z "$first" ] && first="$i"
    if ! is_usb_radio "$i"; then
      echo "$i"
      return
    fi
  done
  echo "$first"
}

# The radio that joins the home network: any radio other than the access point's (empty if there is only one).
client_radio() {
  local ap i
  ap="$(ap_radio)"
  for i in $(wifi_interfaces); do
    if [ "$i" != "$ap" ]; then
      echo "$i"
      return
    fi
  done
}

radio_mac() {
  cat "/sys/class/net/$1/address"
}

#!/bin/bash
# RePicoBrew Raspberry Pi Access Point Setup
# Sets up WiFi AP with DNS spoofing for picobrew.com

set -e

# Configuration
SSID="PICOBREW"
PASSWORD="picobrew123"
AP_IP="192.168.72.1"
AP_NETWORK="192.168.72.0"
AP_NETMASK="255.255.255.0"
DHCP_RANGE_START="192.168.72.10"
DHCP_RANGE_END="192.168.72.100"
WIFI_INTERFACE="wlan0"
CHANNEL="7"

echo "========================================="
echo "RePicoBrew Pi Access Point Setup"
echo "========================================="
echo ""
echo "Configuration:"
echo "  SSID: $SSID"
echo "  Password: $PASSWORD"
echo "  AP IP: $AP_IP"
echo "  Network: $AP_NETWORK/$AP_NETMASK"
echo "  DHCP Range: $DHCP_RANGE_START - $DHCP_RANGE_END"
echo "  Interface: $WIFI_INTERFACE"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "Error: Please run as root (use sudo)"
  exit 1
fi

# Install required packages
echo "Installing required packages..."
apt update
apt install -y hostapd dnsmasq

# Stop services while we configure
echo "Stopping services..."
systemctl stop hostapd || true
systemctl stop dnsmasq || true

# Configure static IP for wlan0
echo "Configuring static IP for $WIFI_INTERFACE..."
cat > /etc/dhcpcd.conf.d/picobrew.conf <<EOF
# RePicoBrew AP Configuration
interface $WIFI_INTERFACE
    static ip_address=$AP_IP/24
    nohook wpa_supplicant
EOF

# Configure hostapd
echo "Configuring hostapd..."
cat > /etc/hostapd/hostapd.conf <<EOF
# RePicoBrew AP - hostapd configuration
interface=$WIFI_INTERFACE
driver=nl80211
ssid=$SSID
hw_mode=g
channel=$CHANNEL
wmm_enabled=0
macaddr_acl=0
auth_algs=1
ignore_broadcast_ssid=0
wpa=2
wpa_passphrase=$PASSWORD
wpa_key_mgmt=WPA-PSK
wpa_pairwise=TKIP
rsn_pairwise=CCMP
EOF

# Tell hostapd where its config is
echo "Configuring hostapd defaults..."
cat > /etc/default/hostapd <<EOF
# Defaults for hostapd initscript
DAEMON_CONF="/etc/hostapd/hostapd.conf"
EOF

# Configure dnsmasq
echo "Configuring dnsmasq..."

# Backup original dnsmasq.conf
if [ -f /etc/dnsmasq.conf ] && [ ! -f /etc/dnsmasq.conf.backup ]; then
  cp /etc/dnsmasq.conf /etc/dnsmasq.conf.backup
fi

# Create dnsmasq config for picobrew
cat > /etc/dnsmasq.d/picobrew.conf <<EOF
# RePicoBrew dnsmasq configuration

# Listen on wlan0 only
interface=$WIFI_INTERFACE

# DHCP range
dhcp-range=$DHCP_RANGE_START,$DHCP_RANGE_END,$AP_NETMASK,24h

# DNS - spoof picobrew.com to our AP IP
address=/picobrew.com/$AP_IP
address=/www.picobrew.com/$AP_IP

# Upstream DNS (when not spoofed)
server=8.8.8.8
server=8.8.4.4

# Don't read /etc/resolv.conf
no-resolv

# Don't read /etc/hosts
no-hosts

# Log queries (for debugging)
log-queries
log-dhcp
EOF

# Enable IP forwarding (for optional internet sharing)
echo "Enabling IP forwarding..."
if ! grep -q "net.ipv4.ip_forward=1" /etc/sysctl.conf; then
  echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf
fi
sysctl -w net.ipv4.ip_forward=1

# Unmask and enable services
echo "Enabling services..."
systemctl unmask hostapd
systemctl enable hostapd
systemctl enable dnsmasq

# The pi-image build customizes a disk image offline (via libguestfs/virt-customize, no live
# systemd or wlan0 hardware present) — everything above (packages, config files, `enable`) works
# fine there since it's just filesystem/symlink changes, but actually starting the services below
# only makes sense on a real running system. `pi-image/build.sh` sets this so the exact same script
# configures both a live Pi (the normal path) and a fresh image at build time.
if [ "${SKIP_SERVICE_START:-0}" = "1" ]; then
  echo "SKIP_SERVICE_START=1 — services enabled but left stopped (image-build mode)."
  exit 0
fi

# Restart dhcpcd to apply static IP
echo "Restarting dhcpcd..."
systemctl restart dhcpcd

# Give it a moment to apply
sleep 2

# Start services
echo "Starting hostapd..."
systemctl start hostapd

echo "Starting dnsmasq..."
systemctl start dnsmasq

# Check status
echo ""
echo "========================================="
echo "Setup Complete!"
echo "========================================="
echo ""

HOSTAPD_STATUS=$(systemctl is-active hostapd)
DNSMASQ_STATUS=$(systemctl is-active dnsmasq)

echo "Service Status:"
echo "  hostapd: $HOSTAPD_STATUS"
echo "  dnsmasq: $DNSMASQ_STATUS"
echo ""

if [ "$HOSTAPD_STATUS" = "active" ] && [ "$DNSMASQ_STATUS" = "active" ]; then
  echo "✓ Access Point is running!"
  echo ""
  echo "WiFi Network Details:"
  echo "  SSID: $SSID"
  echo "  Password: $PASSWORD"
  echo "  Gateway: $AP_IP"
  echo ""
  echo "Test DNS from a connected device:"
  echo "  nslookup picobrew.com"
  echo "  (should resolve to $AP_IP)"
  echo ""
  echo "Next steps:"
  echo "  1. Install nginx: sudo apt install nginx"
  echo "  2. Copy nginx config: sudo cp scripts/nginx-picobrew.conf /etc/nginx/sites-available/picobrew"
  echo "  3. Enable site: sudo ln -s /etc/nginx/sites-available/picobrew /etc/nginx/sites-enabled/"
  echo "  4. Install app service: sudo cp scripts/repicobrew.service /etc/systemd/system/"
  echo "  5. Start services: sudo systemctl start nginx repicobrew"
else
  echo "⚠ Warning: Some services failed to start"
  echo ""
  echo "Check logs:"
  echo "  sudo journalctl -u hostapd -n 50"
  echo "  sudo journalctl -u dnsmasq -n 50"
  echo ""
  echo "Common issues:"
  echo "  - NetworkManager managing wlan0: sudo nmcli device set wlan0 managed no"
  echo "  - Another process using port 53: sudo netstat -tlnp | grep :53"
  echo "  - Wrong WiFi interface name: check with 'ip addr' and update WIFI_INTERFACE"
fi

echo ""

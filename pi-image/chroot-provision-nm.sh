#!/bin/bash
# Provisioning for the NetworkManager-based image (the `pi4` target: current Raspberry Pi OS Lite, arm64, i.e.
# Trixie). Runs INSIDE a chroot into the image's root partition with real network access (called from build.sh on
# the build host — never on the Pi itself). It mirrors what scripts/deploy-to-pi.sh does to a stock Raspberry Pi OS,
# so an image and a deployed Pi end up the same. The older Bullseye/hostapd flow for the Zero W is
# chroot-provision.sh.
#
# Differences from a live deploy that come from being in a chroot: no running systemd (services are enabled by
# symlink), no NetworkManager or Wi-Fi radio (the access point is created on first boot by
# repicobrew-first-boot.service instead), and the app's database/build come from build.sh.
#
# Args: $1 = Node.js tarball URL, $2 = pnpm version
set -euo pipefail

NODE_TARBALL_URL="$1"
PNPM_VERSION="$2"
APP_DIR=/home/pi/RePicoBrew
export DEBIAN_FRONTEND=noninteractive

echo "==> Installing system packages..."
apt-get update
# NetworkManager, iw, bluez, dnsmasq-base (NetworkManager's hotspot DHCP/DNS) and Python 3.13 already ship in the
# Lite image. nginx fronts the app on port 80; the -dev packages are for the Bluetooth scanner's native addon.
apt-get install -y nginx git build-essential python3 rsync curl libbluetooth-dev libudev-dev

echo "==> Installing Node.js from $NODE_TARBALL_URL..."
curl -fsSL "$NODE_TARBALL_URL" -o /tmp/node.tar.gz
mkdir -p /usr/local/lib/nodejs
tar -xzf /tmp/node.tar.gz -C /usr/local/lib/nodejs --strip-components=1
rm /tmp/node.tar.gz
for bin in node npm npx corepack; do
  ln -sf /usr/local/lib/nodejs/bin/$bin /usr/local/bin/$bin
done
# The corepack bundled with older Node 20 releases has stale npm signing keys and fails to download pnpm.
if ! corepack --version | awk -F. '{ exit !(($1 > 0) || ($2 >= 31)) }'; then
  npm install -g --force corepack@latest
fi
corepack enable
corepack prepare "pnpm@${PNPM_VERSION}" --activate

echo "==> Granting Node raw Bluetooth access (Tilt scanner)..."
setcap cap_net_raw+eip /usr/local/lib/nodejs/bin/node

echo "==> Setting up the 'pi' login..."
# The Trixie Lite image ships a `pi` account with no password and a nologin shell, and a first-boot wizard
# (userconfig.service) that asks for a new one on the console; cloud-init would also run on first boot. Give `pi`
# the traditional login instead so the image works headless (SSH is enabled by build.sh), and turn both first-boot
# mechanisms off.
usermod -s /bin/bash pi
echo 'pi:raspberry' | chpasswd
for g in sudo adm dialout cdrom audio video plugdev games users input render netdev bluetooth gpio i2c spi; do
  getent group "$g" >/dev/null && usermod -aG "$g" pi || true
done
[ -f /etc/sudoers.d/010_pi-nopasswd ] || {
  echo 'pi ALL=(ALL) NOPASSWD: ALL' > /etc/sudoers.d/010_pi-nopasswd
  chmod 0440 /etc/sudoers.d/010_pi-nopasswd
}
mkdir -p /etc/systemd/system
ln -sf /dev/null /etc/systemd/system/userconfig.service
mkdir -p /etc/cloud && touch /etc/cloud/cloud-init.disabled
mkdir -p /etc/systemd/system/multi-user.target.wants
ln -sf /lib/systemd/system/ssh.service /etc/systemd/system/multi-user.target.wants/ssh.service

echo "==> Installing network wrapper scripts (hostname/AP/Wi-Fi/radio control)..."
mkdir -p /usr/local/sbin/repicobrew-network
for s in apply-hostname apply-ap apply-wifi setup-nm-ap wifi-radios first-boot-ap check-updates start-updates power \
  wlan1-watchdog bluetooth-radio wifi-client-radio; do
  cp "$APP_DIR/scripts/network/$s.sh" /usr/local/sbin/repicobrew-network/
done
chmod 0755 /usr/local/sbin/repicobrew-network/*.sh
chown -R root:root /usr/local/sbin/repicobrew-network

echo "==> Granting 'pi' narrow passwordless sudo for system/network control..."
cat > /etc/sudoers.d/repicobrew-control <<'SUDOERS'
pi ALL=(root) NOPASSWD: /usr/local/sbin/repicobrew-network/power.sh restart
pi ALL=(root) NOPASSWD: /usr/local/sbin/repicobrew-network/power.sh reboot
pi ALL=(root) NOPASSWD: /usr/local/sbin/repicobrew-network/power.sh shutdown
pi ALL=(root) NOPASSWD: /usr/local/sbin/repicobrew-network/check-updates.sh
pi ALL=(root) NOPASSWD: /usr/local/sbin/repicobrew-network/start-updates.sh
pi ALL=(root) NOPASSWD: /usr/local/sbin/repicobrew-network/apply-hostname.sh *
pi ALL=(root) NOPASSWD: /usr/local/sbin/repicobrew-network/apply-ap.sh *
pi ALL=(root) NOPASSWD: /usr/local/sbin/repicobrew-network/apply-wifi.sh *
pi ALL=(root) NOPASSWD: /usr/local/sbin/repicobrew-network/bluetooth-radio.sh on
pi ALL=(root) NOPASSWD: /usr/local/sbin/repicobrew-network/bluetooth-radio.sh off
pi ALL=(root) NOPASSWD: /usr/local/sbin/repicobrew-network/wifi-client-radio.sh on
pi ALL=(root) NOPASSWD: /usr/local/sbin/repicobrew-network/wifi-client-radio.sh off
SUDOERS
chmod 0440 /etc/sudoers.d/repicobrew-control
visudo -cf /etc/sudoers.d/repicobrew-control

echo "==> Configuring nginx reverse proxy..."
rm -f /etc/nginx/sites-enabled/default
ln -sf "$APP_DIR/scripts/nginx-picobrew.conf" /etc/nginx/sites-enabled/picobrew
mkdir -p /var/www/repicobrew
install -m 0644 "$APP_DIR/scripts/starting.html" /var/www/repicobrew/repicobrew-starting.html
ln -sf /lib/systemd/system/nginx.service /etc/systemd/system/multi-user.target.wants/nginx.service

echo "==> Installing systemd services (enabled by symlink; they start on first boot)..."
for u in repicobrew tilt-ble wlan1-watchdog repicobrew-first-boot; do
  cp "$APP_DIR/scripts/$u.service" /etc/systemd/system/
  ln -sf "/etc/systemd/system/$u.service" "/etc/systemd/system/multi-user.target.wants/$u.service"
done

chown -R pi:pi "$APP_DIR"
cd "$APP_DIR"

echo "==> Installing app dependencies..."
# build.sh generates the Prisma client and applies migrations on the build host and copies in the host-built
# bundle, so the install-time `prisma generate` is dropped for this one install (in the image's copy only).
node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json'));delete p.scripts.postinstall;fs.writeFileSync('package.json',JSON.stringify(p,null,2))"
sudo -u pi bash -c 'HUSKY=0 pnpm install --frozen-lockfile'

echo "==> Installing SearXNG (private web search for the AI Brewmaster)..."
SKIP_SERVICE_START=1 bash "$APP_DIR/scripts/setup-searxng.sh"

echo "=== chroot provisioning (install phase) complete ==="

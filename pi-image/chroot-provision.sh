#!/bin/bash
# Runs INSIDE a chroot into the target image's root partition, under qemu-user emulation, with
# real network access (called from build.sh on the build host — never runs on the Pi itself).
# This is what makes the Pi need zero internet on first boot: everything below — packages,
# Node.js, the built app, even the database — gets baked into the image right here.
#
# Args: $1 = Node.js tarball URL (architecture-correct — see build.sh), $2 = pnpm version
set -euo pipefail

NODE_TARBALL_URL="$1"
PNPM_VERSION="$2"
APP_DIR=/home/pi/RePicoBrew

echo "==> apt-get update + dist-upgrade..."
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get -y dist-upgrade

echo "==> Installing system packages..."
# Deliberately NOT installing nodejs via apt/NodeSource here — see the Node.js step below for why.
apt-get install -y hostapd dnsmasq nginx git build-essential python3 \
  bluetooth bluez libbluetooth-dev libudev-dev
# apt's postinst already symlinked hostapd/dnsmasq/nginx into multi-user.target.wants — no
# `systemctl enable` needed (and wouldn't work here anyway; there's no running init in a chroot).

echo "==> Installing Node.js from $NODE_TARBALL_URL..."
# NOT via apt/NodeSource: NodeSource's "armhf" Node.js is compiled for ARMv7-A + NEON
# (confirmed via `readelf -A` — Tag_CPU_arch: v7, Tag_Advanced_SIMD_arch: NEONv1) and crashes
# with "Illegal instruction" on a Zero W's real ARMv6 (ARM1176JZF-S) silicon, despite installing
# without error under this chroot's ARMv7-emulating qemu-arm-static. The unofficial-builds.
# nodejs.org armv6l tarball is a genuine ARMv6KZ/VFPv2 build (verified the same way) and is the
# correct choice for that hardware; arm64 has no such split, so it just uses the official tarball.
curl -fsSL "$NODE_TARBALL_URL" -o /tmp/node.tar.gz
mkdir -p /usr/local/lib/nodejs
tar -xzf /tmp/node.tar.gz -C /usr/local/lib/nodejs --strip-components=1
rm /tmp/node.tar.gz
for bin in node npm npx corepack; do
  ln -sf /usr/local/lib/nodejs/bin/$bin /usr/local/bin/$bin
done

echo "==> Enabling pnpm via corepack..."
corepack enable
corepack prepare "pnpm@${PNPM_VERSION}" --activate

echo "==> Granting Node BLE permissions..."
setcap cap_net_raw+eip /usr/local/lib/nodejs/bin/node
usermod -aG bluetooth pi

echo "==> Configuring WiFi AP + DNS spoofing (offline mode)..."
# SKIP_SERVICE_START=1: writes config + enables services (symlinks only) without trying to
# actually start hostapd against real wlan0 hardware, which doesn't exist in this chroot. This is
# exactly what that flag in scripts/setup-pi-ap.sh was originally designed for.
SKIP_SERVICE_START=1 bash "$APP_DIR/scripts/setup-pi-ap.sh"

echo "==> Configuring nginx reverse proxy..."
rm -f /etc/nginx/sites-enabled/default
ln -sf "$APP_DIR/scripts/nginx-picobrew.conf" /etc/nginx/sites-enabled/picobrew

echo "==> Installing systemd services..."
cp "$APP_DIR/scripts/repicobrew.service" /etc/systemd/system/
cp "$APP_DIR/scripts/tilt-ble.service" /etc/systemd/system/
mkdir -p /etc/systemd/system/multi-user.target.wants
ln -sf /etc/systemd/system/repicobrew.service /etc/systemd/system/multi-user.target.wants/repicobrew.service
ln -sf /etc/systemd/system/tilt-ble.service /etc/systemd/system/multi-user.target.wants/tilt-ble.service

chown -R pi:pi "$APP_DIR"

echo "==> Installing app dependencies (real network, real CPU emulation — this is the slow step)..."
cd "$APP_DIR"
sudo -u pi bash -c 'HUSKY=0 /usr/local/bin/pnpm install'

echo "==> Generating Prisma client, applying migrations, seeding..."
sudo -u pi /usr/local/bin/pnpm exec prisma generate
sudo -u pi /usr/local/bin/pnpm exec prisma migrate deploy
sudo -u pi /usr/local/bin/pnpm exec prisma db seed

echo "==> Building production bundle..."
sudo -u pi bash -c '/usr/local/bin/pnpm build'

echo "==> Cleaning up apt cache..."
apt-get clean
rm -rf /var/lib/apt/lists/*

echo "=== chroot provisioning complete ==="

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
# `iw` creates/manages the virtual uap0 AP interface (see scripts/network/create-uap0.sh); `iptables`
# does the uap0->wlan0 NAT in that same script; `wpasupplicant` provides `wpa_passphrase`, used by
# scripts/network/apply-wifi.sh to join the user's home network for real (previously a stub).
apt-get install -y hostapd dnsmasq nginx git build-essential python3 \
  bluetooth bluez libbluetooth-dev libudev-dev iw iptables wpasupplicant
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

# Lets the unprivileged `pi` user run `wpa_cli` against wlan0's control socket without sudo (see
# app/utils/wifi.server.ts's listNearbyNetworks) — matches the `ctrl_interface_group=netdev` that
# scripts/network/apply-wifi.sh writes into wpa_supplicant.conf.
usermod -aG netdev pi

echo "==> Setting a known login password for 'pi'..."
# Raspberry Pi OS dropped the default pi/raspberry account entirely as of April 2022 (see
# https://www.raspberrypi.com/news/raspberry-pi-bullseye-update-april-2022/) — a fresh account now
# only gets a password via Raspberry Pi Imager's own interactive customization (a userconf.txt on
# the boot partition), which this build deliberately bypasses by writing the raw .img directly.
# Without this, there is NO way to log in at all — not over SSH, not even over a directly-wired
# UART serial console — confirmed the hard way debugging on real hardware. Setting it explicitly
# here restores the traditional, well-known "raspberry" default for both paths.
echo 'pi:raspberry' | chpasswd

echo "==> Installing network wrapper scripts (real hostname/AP/WiFi provisioning)..."
# Root-owned, narrowly-scoped scripts that let the unprivileged `pi` user (repicobrew.service runs
# as the unprivileged User=pi) actually apply Settings/Setup wizard network changes to the
# OS instead of only writing them to the database — see app/utils/network-control.server.ts, which
# invokes these via the sudoers rule below.
mkdir -p /usr/local/sbin/repicobrew-network
cp "$APP_DIR/scripts/network/apply-hostname.sh" /usr/local/sbin/repicobrew-network/
cp "$APP_DIR/scripts/network/apply-ap.sh" /usr/local/sbin/repicobrew-network/
cp "$APP_DIR/scripts/network/apply-wifi.sh" /usr/local/sbin/repicobrew-network/
cp "$APP_DIR/scripts/network/create-uap0.sh" /usr/local/sbin/repicobrew-network/
cp "$APP_DIR/scripts/network/sync-ap-channel.sh" /usr/local/sbin/repicobrew-network/
cp "$APP_DIR/scripts/network/check-updates.sh" /usr/local/sbin/repicobrew-network/
cp "$APP_DIR/scripts/network/start-updates.sh" /usr/local/sbin/repicobrew-network/
cp "$APP_DIR/scripts/network/power.sh" /usr/local/sbin/repicobrew-network/
cp "$APP_DIR/scripts/network/setup-nm-ap.sh" /usr/local/sbin/repicobrew-network/
cp "$APP_DIR/scripts/network/wifi-radios.sh" /usr/local/sbin/repicobrew-network/
cp "$APP_DIR/scripts/network/wlan1-watchdog.sh" /usr/local/sbin/repicobrew-network/
chmod 0755 /usr/local/sbin/repicobrew-network/*.sh
chown -R root:root /usr/local/sbin/repicobrew-network

echo "==> Installing create-uap0.service (virtual AP interface, boots before hostapd)..."
cp "$APP_DIR/scripts/create-uap0.service" /etc/systemd/system/
mkdir -p /etc/systemd/system/multi-user.target.wants
ln -sf /etc/systemd/system/create-uap0.service /etc/systemd/system/multi-user.target.wants/create-uap0.service

echo "==> Installing repicobrew-ap-channel.service (keeps the AP on the client Wi-Fi channel)..."
# One radio, one channel: without this the AP vanishes as soon as wlan0 joins a home network on a
# channel other than hostapd.conf's — see scripts/network/sync-ap-channel.sh.
cp "$APP_DIR/scripts/repicobrew-ap-channel.service" /etc/systemd/system/
ln -sf /etc/systemd/system/repicobrew-ap-channel.service /etc/systemd/system/multi-user.target.wants/repicobrew-ap-channel.service

echo "==> Installing wlan1-watchdog.service (recovers the client Wi-Fi radio if it drops off)..."
# The USB Wi-Fi dongle providing internet has been observed dropping and never recovering on its
# own — see scripts/network/wlan1-watchdog.sh for what's been confirmed on real hardware.
cp "$APP_DIR/scripts/wlan1-watchdog.service" /etc/systemd/system/
ln -sf /etc/systemd/system/wlan1-watchdog.service /etc/systemd/system/multi-user.target.wants/wlan1-watchdog.service

echo "==> Configuring WiFi AP + DNS spoofing (offline mode)..."
# SKIP_SERVICE_START=1: writes config + enables services (symlinks only) without trying to
# actually start hostapd against real uap0 hardware, which doesn't exist in this chroot (uap0 is
# only created at real boot, by create-uap0.service above). This is exactly what that flag in
# scripts/setup-pi-ap.sh was originally designed for.
SKIP_SERVICE_START=1 bash "$APP_DIR/scripts/setup-pi-ap.sh"

echo "==> Configuring nginx reverse proxy..."
rm -f /etc/nginx/sites-enabled/default
ln -sf "$APP_DIR/scripts/nginx-picobrew.conf" /etc/nginx/sites-enabled/picobrew
mkdir -p /var/www/repicobrew
install -m 0644 "$APP_DIR/scripts/starting.html" /var/www/repicobrew/repicobrew-starting.html

echo "==> Installing systemd services..."
cp "$APP_DIR/scripts/repicobrew.service" /etc/systemd/system/
cp "$APP_DIR/scripts/tilt-ble.service" /etc/systemd/system/
mkdir -p /etc/systemd/system/multi-user.target.wants
ln -sf /etc/systemd/system/repicobrew.service /etc/systemd/system/multi-user.target.wants/repicobrew.service
ln -sf /etc/systemd/system/tilt-ble.service /etc/systemd/system/multi-user.target.wants/tilt-ble.service

echo "==> Granting 'pi' narrow passwordless sudo for system/network control..."
# repicobrew.service runs as the unprivileged User=pi, so the app process has no
# privilege on its own to restart itself, reboot the Pi, or touch network config — this is the
# entire escape hatch for both the Settings -> System tab (app/utils/system-control.server.ts) and
# real hostname/AP/WiFi provisioning (app/utils/network-control.server.ts). The network scripts
# take arguments (hostname/SSID/password), unlike the two exact-command system-control entries, so
# they can't use a fully-fixed sudoers line — each script does its own strict input validation
# instead (see scripts/network/*.sh) precisely because the sudoers rule can't do it for them.
cat > /etc/sudoers.d/repicobrew-control <<'EOF'
pi ALL=(root) NOPASSWD: /usr/local/sbin/repicobrew-network/power.sh restart
pi ALL=(root) NOPASSWD: /usr/local/sbin/repicobrew-network/power.sh reboot
pi ALL=(root) NOPASSWD: /usr/local/sbin/repicobrew-network/power.sh shutdown
pi ALL=(root) NOPASSWD: /usr/local/sbin/repicobrew-network/check-updates.sh
pi ALL=(root) NOPASSWD: /usr/local/sbin/repicobrew-network/start-updates.sh
pi ALL=(root) NOPASSWD: /usr/local/sbin/repicobrew-network/apply-hostname.sh *
pi ALL=(root) NOPASSWD: /usr/local/sbin/repicobrew-network/apply-ap.sh *
pi ALL=(root) NOPASSWD: /usr/local/sbin/repicobrew-network/apply-wifi.sh *
EOF
chmod 0440 /etc/sudoers.d/repicobrew-control
visudo -cf /etc/sudoers.d/repicobrew-control

chown -R pi:pi "$APP_DIR"
cd "$APP_DIR"

echo "==> Disabling postinstall's 'prisma generate' for this install..."
# Prisma publishes no native engine binary at all for 32-bit ARM ("linux-arm") — confirmed via a
# 404 fetching the query-engine, and again on the schema-engine, so `prisma generate`/`migrate`
# can never succeed running natively under this chroot's qemu-arm emulation. build.sh instead runs
# them on the build host itself (real amd64/arm64 — an architecture Prisma fully supports),
# targeting this same mounted rootfs right after this script exits. That's safe because the
# schema uses engineType="client": the generated output is pure JS+WASM, so it doesn't matter
# which machine produced it. Stripping the key here (in the image's own copy of package.json,
# not the git-tracked source) only affects this one install.
#
# Also add pnpm.neverBuiltDependencies for esbuild here — its prebuilt Go binary is ARMv7-only
# (no from-source fallback), and setting ESBUILD_BINARY_PATH to a dummy file does NOT skip its
# postinstall's own `validateBinaryVersion` check on that path (confirmed: it still runs the
# override target and rejects it for not reporting itself as esbuild) — only skipping the
# install script outright avoids the crash. This can't be a permanent package.json setting
# instead, since the HOST-side build (build.sh) needs esbuild's postinstall to actually run there.
node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json'));delete p.scripts.postinstall;p.pnpm=Object.assign({},p.pnpm,{neverBuiltDependencies:['esbuild']});fs.writeFileSync('package.json',JSON.stringify(p,null,2))"

echo "==> Installing app dependencies (real network, real CPU emulation — this is the slow step)..."
# Three things that need explicit handling here, all confirmed the hard way by inspecting the
# actual installed files/ELF attributes after each fix landed:
#   1. `sudo` resets the environment by default (Debian's sudoers has `env_reset`), so QEMU_CPU
#      (set in build.sh, meant to make gcc target the Zero W's real ARM1176 core instead of
#      whatever qemu-arm-static emulates by default) never reached this subshell at all despite
#      being exported before the chroot call — pass it through explicitly.
#   2. better-sqlite3's install script is `prebuild-install || node-gyp rebuild --release` — it
#      downloads a pre-built binary first, and prebuild-install never actually loads/executes that
#      binary to self-test it, so it "succeeds" under emulation even though the binary is a generic
#      ARMv7 prebuild (confirmed via `readelf -A`: Tag_CPU_arch v7, matching this exact symptom) —
#      the node-gyp fallback, which WOULD respect QEMU_CPU and compile correctly, never even runs.
#      npm_config_build_from_source forces every native dep to always compile from source instead.
#   3. esbuild (a vite/build-only devDependency) ships a prebuilt Go binary with no from-source
#      fallback at all — once QEMU_CPU above actually took effect, its own postinstall crashed
#      with a real SIGILL trying to self-validate that binary (confirmed: it's ARMv7-only too).
#      `pnpm build` runs on the build host instead (see build.sh) and this target never invokes
#      esbuild at all, so its install script is skipped outright via the neverBuiltDependencies
#      edit above — ESBUILD_BINARY_PATH does NOT work around this: esbuild's postinstall still
#      calls validateBinaryVersion() on whatever's at that path even when manually overridden, so
#      pointing it at a dummy file just fails a different, equally-fatal check.
sudo --preserve-env=QEMU_CPU -u pi bash -c 'HUSKY=0 npm_config_build_from_source=true /usr/local/bin/pnpm install'

echo "=== chroot provisioning (install phase) complete ==="

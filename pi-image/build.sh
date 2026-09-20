#!/bin/bash
# Builds a ready-to-flash RePicoBrew Raspberry Pi OS image that boots straight into a working
# PICOBREW access point and a fully-built app — no first-boot provisioning, no internet needed on
# the Pi at all. This matters beyond convenience: this project is meant to be flashed by strangers
# (open source), who won't have a way to hand it their home WiFi credentials or Ethernet.
#
# Run this INSIDE the pi-image/Dockerfile builder container (see pi-image/README.md).
#
# How: loop-mounts the target image's root partition and chroots into it under qemu-user
# emulation (pi-image/chroot-provision.sh), on THIS build machine, with THIS machine's real
# internet access. Every package install, the Node.js runtime, `pnpm install`/`build`, and the
# Prisma-migrated (schema only, no seed data) database all happen right here, baked into the
# image — not deferred to the Pi. (An earlier version of this script tried to do this via
# `virt-customize --run-command`;
# libguestfs flatly refuses to execute guest commands across a host/guest architecture mismatch,
# which is unavoidable for a Pi image. A real chroot + qemu-arm-static has no such restriction.)
#
# Usage:
#   pi-image/build.sh --target zero-w   # Pi Zero W / Zero / 1 — 32-bit, armv6 baseline
#   pi-image/build.sh --target pi4      # Pi 3/4/5 and CM4 — 64-bit
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CACHE_DIR="$SCRIPT_DIR/cache"
WORK_DIR="$SCRIPT_DIR/work"

# Last dhcpcd-based Raspberry Pi OS release — scripts/setup-pi-ap.sh writes dhcpcd.conf.d config
# and expects wpa_supplicant to be dhcpcd-managed. Every release since Bookworm (Oct 2023) defaults
# to NetworkManager instead, which fights hostapd for wlan0 and ignores those config files
# entirely — building against "latest" would silently produce an image whose AP never comes up.
# See pi-image/README.md for what porting to NetworkManager would take.
BULLSEYE_DATE="2023-05-03"

TARGET=""
HOSTNAME="repicobrew"
OUTPUT=""
SKIP_DOWNLOAD=0
GROW_BY_GB=4

usage() {
  cat <<'EOF'
Usage: pi-image/build.sh --target <zero-w|pi4> [options]

  --target <zero-w|pi4>   Required. zero-w = 32-bit/armv6 (Pi Zero W/Zero/1).
                           pi4 = 64-bit (Pi 3, 4, 5, CM4). Same image works for pi5.
  --hostname <name>       Pi hostname (default: repicobrew)
  --output <path>         Output .img path (default: pi-image/work/repicobrew-<target>-<date>.img)
  --skip-download         Reuse a previously downloaded base image from pi-image/cache/
  --grow-by <GB>          Extra space added to the root filesystem (default: 4)
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --target) TARGET="$2"; shift 2 ;;
    --hostname) HOSTNAME="$2"; shift 2 ;;
    --output) OUTPUT="$2"; shift 2 ;;
    --skip-download) SKIP_DOWNLOAD=1; shift ;;
    --grow-by) GROW_BY_GB="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
  esac
done

# @react-router/dev AND @react-router/serve hard-require Node >=20.0.0 (confirmed by hitting that
# exact failure with 18.20.8 — this isn't just a build-time tool requirement, `pnpm start` needs it
# too). Pinned to an early 20.x point release deliberately: the latest (20.20.2) is compiled against
# a newer glibc/libstdc++ (needs GLIBCXX_3.4.29/30) than Bullseye ships, and fails to even run
# ("version `GLIBCXX_3.4.30' not found") — confirmed via `objdump -T` that 20.9.0 only needs up to
# GLIBCXX_3.4.21, comfortably within what Bullseye provides, while still satisfying the >=20.0.0
# floor. unofficial-builds.nodejs.org publishes genuine ARMv6 builds for this version too.
NODE_VERSION="20.9.0"

case "$TARGET" in
  zero-w)
    ARCH="armhf"
    BASE_FILENAME="${BULLSEYE_DATE}-raspios-bullseye-armhf-lite.img.xz"
    BASE_SHA256="b5e3a1d984a7eaa402a6e078d707b506b962f6804d331dcc0daa61debae3a19a"
    QEMU_STATIC_BIN="qemu-arm-static"
    # NOT the official/NodeSource armhf build — that's compiled for ARMv7-A+NEON and crashes with
    # "Illegal instruction" on a Zero W's real ARMv6 (ARM1176JZF-S) silicon (confirmed via
    # `readelf -A`: Tag_CPU_arch v7 vs. this build's v6KZ). unofficial-builds.nodejs.org
    # specifically maintains genuine ARMv6 builds for this exact hardware class.
    NODE_TARBALL_URL="https://unofficial-builds.nodejs.org/download/release/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-armv6l.tar.gz"
    # qemu-arm-static's default emulated CPU is a modern ARMv7-class core, NOT the Zero W's real
    # ARM1176JZF-S — confirmed the hard way: better-sqlite3, compiled from source during this
    # chroot's `pnpm install` under that default emulation, crashed with "Illegal instruction" at
    # RUNTIME on real hardware (gcc's own CPU auto-detection sees whatever qemu presents, not the
    # real target). QEMU_CPU pins the emulated CPU to `arm1176` (a real, exact model qemu-arm-static
    # supports — see `qemu-arm-static -cpu help`) so every native addon compiled in this chroot
    # (better-sqlite3, @stoprocent/noble) targets the actual hardware instead.
    export QEMU_CPU="arm1176"
    ;;
  pi4)
    ARCH="arm64"
    BASE_FILENAME="${BULLSEYE_DATE}-raspios-bullseye-arm64-lite.img.xz"
    BASE_SHA256="bf982e56b0374712d93e185780d121e3f5c3d5e33052a95f72f9aed468d58fa7"
    QEMU_STATIC_BIN="qemu-aarch64-static"
    # arm64/aarch64 has no ARMv6-style baseline split — the official build is fine.
    NODE_TARBALL_URL="https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-arm64.tar.gz"
    # No equivalent baseline-mismatch risk on arm64 — leave qemu-aarch64-static's default CPU as-is.
    export QEMU_CPU=""
    ;;
  "")
    echo "Error: --target is required" >&2; usage; exit 1 ;;
  *)
    echo "Error: unknown --target '$TARGET' (expected zero-w or pi4)" >&2; exit 1 ;;
esac

BASE_URL="https://downloads.raspberrypi.com/raspios_lite_${ARCH}/images/raspios_lite_${ARCH}-${BULLSEYE_DATE}/${BASE_FILENAME}"
DATE_STAMP="$(date +%Y%m%d)"
OUTPUT="${OUTPUT:-$WORK_DIR/repicobrew-${TARGET}-${DATE_STAMP}.img}"

mkdir -p "$CACHE_DIR" "$WORK_DIR"

command -v virt-customize >/dev/null || { echo "Error: virt-customize not found — run this inside pi-image/Dockerfile's builder image." >&2; exit 1; }
command -v virt-resize >/dev/null || { echo "Error: virt-resize not found — run this inside pi-image/Dockerfile's builder image." >&2; exit 1; }

echo "==> Target: $TARGET ($ARCH), base image: raspios-bullseye-${ARCH}-lite (${BULLSEYE_DATE})"

# --- 1. Download + verify the base image -----------------------------------------------------
COMPRESSED="$CACHE_DIR/$BASE_FILENAME"
if [ "$SKIP_DOWNLOAD" = "1" ] && [ -f "$COMPRESSED" ]; then
  echo "==> --skip-download set, reusing cached $COMPRESSED"
else
  echo "==> Downloading base image (this is a few hundred MB)..."
  wget -q --show-progress -O "$COMPRESSED" "$BASE_URL"
fi

echo "==> Verifying checksum..."
echo "${BASE_SHA256}  ${COMPRESSED}" | sha256sum -c - || {
  echo "Error: checksum mismatch on $COMPRESSED — delete pi-image/cache/ and retry." >&2
  exit 1
}

RAW_IMG="$WORK_DIR/${TARGET}-base.img"
echo "==> Decompressing..."
xz -dk -c "$COMPRESSED" > "$RAW_IMG"

# --- 2. Grow the root partition ---------------------------------------------------------------
# node_modules + the Prisma/better-sqlite3 build toolchain need real headroom over the ~400MB
# free space Raspberry Pi OS Lite ships with. virt-resize wants a pre-sized destination file, not
# an in-place resize.
CURRENT_SIZE=$(stat -c%s "$RAW_IMG" 2>/dev/null || stat -f%z "$RAW_IMG")
NEW_SIZE=$((CURRENT_SIZE + GROW_BY_GB * 1024 * 1024 * 1024))
echo "==> Growing image by ${GROW_BY_GB}GiB..."
truncate -s "$NEW_SIZE" "$OUTPUT"
virt-resize --expand /dev/sda2 "$RAW_IMG" "$OUTPUT"
rm -f "$RAW_IMG"

# --- 3. Stage a clean copy of the repo (no node_modules/.git/build) ---------------------------
# rsync from the actual working tree, not `git archive HEAD` — this ships whatever is currently
# on disk (including uncommitted work-in-progress), which is what "build an image from what I
# have right now" should mean. Excludes node_modules/.git/build (rebuilt fresh below) and
# pi-image's own cache/work dirs (this script's scratch space, not app source).
# prisma/picobrew.db* is excluded too — without this, the dev machine's own live database
# (complete with real recipes/sessions/users, everything) ships inside the image. The image gets a
# clean, schema-only database from `migrate deploy` instead (no seed data — see chroot-finish.sh).
STAGE_DIR="$WORK_DIR/repo-stage"
rm -rf "$STAGE_DIR"
mkdir -p "$STAGE_DIR"
echo "==> Staging repo source (working tree, excluding node_modules/.git/build)..."
rsync -a \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='build' \
  --exclude='pi-image/cache' \
  --exclude='pi-image/work' \
  --exclude='.DS_Store' \
  --exclude='.cache' \
  --exclude='.claude' \
  --exclude='prisma/picobrew.db*' \
  "$REPO_DIR/" "$STAGE_DIR/"

# Plain grep/sed instead of a JSON parser, just to pull "pnpm@X.Y.Z" out of package.json's
# packageManager field.
PNPM_VERSION="$(grep -o '"packageManager": *"pnpm@[^"]*"' "$REPO_DIR/package.json" | sed -E 's/.*pnpm@([^"]*)"/\1/')"
PNPM_VERSION="${PNPM_VERSION:-9.7.1}"

# --- 3b. Build the app entirely on this host, never under ARM emulation ------------------------
# esbuild (vite's bundler, used by `pnpm build`) ships a prebuilt Go binary with no from-source
# fallback at all — confirmed ARMv7-only via a real SIGILL once QEMU_CPU (below) correctly
# restricted emulation to the Zero W's actual ARM1176 core. The build output itself
# (build/client, build/server) is pure JS/CSS/HTML with no native code, so building it on this
# host's own architecture and copying the result into the image afterward is both correct and
# necessary — see chroot-provision.sh (still installs devDependencies for completeness, but
# neutralizes esbuild's install-time crash since it's never actually invoked there) and
# chroot-finish.sh (no longer runs `pnpm build` at all).
HOST_BUILD_DIR="$WORK_DIR/host-build"
echo "==> Building app on this host's own architecture (esbuild has no working ARM build)..."
rm -rf "$HOST_BUILD_DIR"
cp -a "$STAGE_DIR" "$HOST_BUILD_DIR"
(cd "$HOST_BUILD_DIR" && HUSKY=0 pnpm install && pnpm build)

# --- 4. Loop-mount the image and chroot in to provision it for real ----------------------------
# This is the step that makes the Pi need zero internet on first boot: everything below — apt
# packages, Node.js, `pnpm install`/`build`, even the migrated (schema-only) database — happens right
# here, on this build machine, under qemu-user emulation, with this machine's real network access,
# and gets baked directly into the image. See chroot-provision.sh and the file header above for
# why this replaced an earlier `virt-customize --run-command`-based approach.
ROOT_MNT="$WORK_DIR/root-mnt"
BOOT_MNT="$WORK_DIR/boot-mnt"
mkdir -p "$ROOT_MNT" "$BOOT_MNT"
LOOP_DEV=""

cleanup() {
  set +e
  if [ -n "$LOOP_DEV" ]; then
    umount "$ROOT_MNT/dev" 2>/dev/null
    umount "$ROOT_MNT/proc" 2>/dev/null
    umount "$ROOT_MNT/sys" 2>/dev/null
    umount "$BOOT_MNT" 2>/dev/null
    umount "$ROOT_MNT" 2>/dev/null
    kpartx -d "$LOOP_DEV" 2>/dev/null
    losetup -d "$LOOP_DEV" 2>/dev/null
  fi
}
trap cleanup EXIT

echo "==> Loop-mounting $OUTPUT..."
LOOP_DEV="$(losetup -fP --show "$OUTPUT")"
# losetup -P asks the kernel to scan the partition table (confirmed via `lsblk`, which sees
# loop0p1/loop0p2 immediately), but this container has no running udevd to actually create the
# /dev/loop0pN device NODES for them — on a real Linux host udev would do this automatically.
# kpartx creates equivalent /dev/mapper/loopXpN nodes itself via device-mapper, sidestepping the
# missing udev entirely (confirmed working while building this; the udev-node approach never
# appeared even after a 10s wait).
kpartx -av "$LOOP_DEV"
LOOP_NAME="$(basename "$LOOP_DEV")"
MAPPER_ROOT="/dev/mapper/${LOOP_NAME}p2"
MAPPER_BOOT="/dev/mapper/${LOOP_NAME}p1"
[ -e "$MAPPER_ROOT" ] || { echo "Error: $MAPPER_ROOT missing after kpartx" >&2; exit 1; }
mount "$MAPPER_ROOT" "$ROOT_MNT"
mount "$MAPPER_BOOT" "$BOOT_MNT"

echo "==> Copying repo source and provisioning tools into the image..."
rm -rf "$ROOT_MNT/home/pi/RePicoBrew"
cp -a "$STAGE_DIR" "$ROOT_MNT/home/pi/RePicoBrew"
cp "$SCRIPT_DIR/chroot-provision.sh" "$ROOT_MNT/tmp/chroot-provision.sh"
chmod 0755 "$ROOT_MNT/tmp/chroot-provision.sh"
cp "$REPO_DIR/scripts/repicobrew.service" "$ROOT_MNT/home/pi/RePicoBrew/scripts/"
cp "$(command -v "$QEMU_STATIC_BIN")" "$ROOT_MNT/usr/bin/$QEMU_STATIC_BIN"
cp /etc/resolv.conf "$ROOT_MNT/etc/resolv.conf"
echo "$HOSTNAME" > "$ROOT_MNT/etc/hostname"
sed -i "s/127.0.1.1.*/127.0.1.1\t$HOSTNAME/" "$ROOT_MNT/etc/hosts" 2>/dev/null || true
touch "$BOOT_MNT/ssh"
# Without this, the Zero W's GPIO serial console uses the "mini UART", whose clock is tied to the
# CPU's core frequency and drifts under frequency scaling — producing garbled output. Also pins
# core_freq to stabilize it. Confirmed necessary the hard way, debugging over a real UART cable.
if ! grep -q '^enable_uart=1$' "$BOOT_MNT/config.txt" 2>/dev/null; then
  printf '\n[all]\nenable_uart=1\n' >> "$BOOT_MNT/config.txt"
fi

mount --bind /dev "$ROOT_MNT/dev"
mount -t proc proc "$ROOT_MNT/proc"
mount -t sysfs sysfs "$ROOT_MNT/sys"

echo "==> Provisioning inside the image (this is the slow step — expect 15-45+ minutes, mostly"
echo "    native addon compilation for better-sqlite3/@stoprocent/noble under emulation)..."
chroot "$ROOT_MNT" "/usr/bin/$QEMU_STATIC_BIN" /bin/bash "/tmp/chroot-provision.sh" \
  "$NODE_TARBALL_URL" "$PNPM_VERSION"

# Prisma publishes no native engine binary for 32-bit ARM ("linux-arm") at all — confirmed via a
# 404 on both the query-engine and schema-engine. Run `generate`/`migrate deploy` here instead, on
# this build host's own native architecture (amd64/arm64 — both fully supported by Prisma),
# directly against the image mounted at $ROOT_MNT. Safe because the schema uses
# engineType="client": the generated output is pure JS+WASM, so it doesn't matter which machine
# produced it. `db seed` still has to run inside the chroot below — it loads the ARM-compiled
# better-sqlite3 native binding via the driver adapter, which this host's Node can't touch.
APP_DIR_HOST="$ROOT_MNT/home/pi/RePicoBrew"
echo "==> Generating Prisma client + applying migrations (on build host, not under ARM emulation)..."
(cd "$APP_DIR_HOST" && node node_modules/prisma/build/index.js generate)
(cd "$APP_DIR_HOST" && node node_modules/prisma/build/index.js migrate deploy)

echo "==> Copying the host-built production bundle into the image..."
rm -rf "$APP_DIR_HOST/build"
cp -a "$HOST_BUILD_DIR/build" "$APP_DIR_HOST/build"

# Everything above (Prisma generate/migrate output, the copied build/) runs/lands as this build
# host's own user (root, inside the builder container), which would otherwise leave it all
# unwritable by the `pi` user the app and `db seed` actually run as (both on the Pi and in the
# chroot below).
chown -R 1000:1000 "$APP_DIR_HOST"

cp "$SCRIPT_DIR/chroot-finish.sh" "$ROOT_MNT/tmp/chroot-finish.sh"
chmod 0755 "$ROOT_MNT/tmp/chroot-finish.sh"
chroot "$ROOT_MNT" "/usr/bin/$QEMU_STATIC_BIN" /bin/bash "/tmp/chroot-finish.sh"

echo "==> Cleaning up build-only artifacts from the image..."
rm -f "$ROOT_MNT/usr/bin/$QEMU_STATIC_BIN" "$ROOT_MNT/etc/resolv.conf" \
  "$ROOT_MNT/tmp/chroot-provision.sh" "$ROOT_MNT/tmp/chroot-finish.sh"

cleanup
trap - EXIT

echo ""
echo "==> Done: $OUTPUT"
echo "    Compress before distributing/flashing, e.g.: xz -T0 -k \"$OUTPUT\""
echo "    Flash with Raspberry Pi Imager or: sudo dd if=\"$OUTPUT\" of=/dev/sdX bs=4M status=progress conv=fsync"
echo ""
echo "    First boot needs NO internet and NO provisioning wait — hostapd, nginx, and the app are"
echo "    already installed, built, and enabled. The 'PICOBREW' WiFi network should appear within"
echo "    normal boot time."

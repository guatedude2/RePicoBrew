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
# Prisma-migrated + seeded database all happen right here, baked into the image — not deferred to
# the Pi. (An earlier version of this script tried to do this via `virt-customize --run-command`;
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

NODE_VERSION="18.20.8"

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
    ;;
  pi4)
    ARCH="arm64"
    BASE_FILENAME="${BULLSEYE_DATE}-raspios-bullseye-arm64-lite.img.xz"
    BASE_SHA256="bf982e56b0374712d93e185780d121e3f5c3d5e33052a95f72f9aed468d58fa7"
    QEMU_STATIC_BIN="qemu-aarch64-static"
    # arm64/aarch64 has no ARMv6-style baseline split — the official build is fine.
    NODE_TARBALL_URL="https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-arm64.tar.gz"
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
  "$REPO_DIR/" "$STAGE_DIR/"

# No node in this builder container — plain grep/sed instead of a JSON parser, just to pull
# "pnpm@X.Y.Z" out of package.json's packageManager field.
PNPM_VERSION="$(grep -o '"packageManager": *"pnpm@[^"]*"' "$REPO_DIR/package.json" | sed -E 's/.*pnpm@([^"]*)"/\1/')"
PNPM_VERSION="${PNPM_VERSION:-9.7.1}"

# --- 4. Loop-mount the image and chroot in to provision it for real ----------------------------
# This is the step that makes the Pi need zero internet on first boot: everything below — apt
# packages, Node.js, `pnpm install`/`build`, even the migrated+seeded database — happens right
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

mount --bind /dev "$ROOT_MNT/dev"
mount -t proc proc "$ROOT_MNT/proc"
mount -t sysfs sysfs "$ROOT_MNT/sys"

echo "==> Provisioning inside the image (this is the slow step — expect 15-45+ minutes, mostly"
echo "    native addon compilation for better-sqlite3/@stoprocent/noble under emulation)..."
chroot "$ROOT_MNT" "/usr/bin/$QEMU_STATIC_BIN" /bin/bash "/tmp/chroot-provision.sh" \
  "$NODE_TARBALL_URL" "$PNPM_VERSION"

echo "==> Cleaning up build-only artifacts from the image..."
rm -f "$ROOT_MNT/usr/bin/$QEMU_STATIC_BIN" "$ROOT_MNT/etc/resolv.conf" "$ROOT_MNT/tmp/chroot-provision.sh"

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

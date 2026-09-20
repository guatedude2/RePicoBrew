#!/bin/bash
# Pulls the finished /home/pi/RePicoBrew tree (including its ARMv6-compiled native modules and the
# migrated, empty database) out of an image built by build.sh, into a tarball that
# scripts/deploy-to-pi.sh can copy onto a stock Raspberry Pi OS install. Run inside the
# pi-image/Dockerfile builder container (needs --privileged for the loop mount).
#
# Usage: extract-app.sh <image.img> <output.tgz>
set -euo pipefail

IMG="${1:?usage: extract-app.sh <image.img> <output.tgz>}"
OUT="${2:?usage: extract-app.sh <image.img> <output.tgz>}"

MNT="$(mktemp -d)"
LOOP=""
cleanup() {
  set +e
  umount "$MNT" 2>/dev/null
  [ -n "$LOOP" ] && kpartx -d "$LOOP" 2>/dev/null
  [ -n "$LOOP" ] && losetup -d "$LOOP" 2>/dev/null
}
trap cleanup EXIT

LOOP="$(losetup -fP --show "$IMG")"
kpartx -av "$LOOP"
mount -o ro "/dev/mapper/$(basename "$LOOP")p2" "$MNT"
tar czf "$OUT" -C "$MNT/home/pi" RePicoBrew
echo "==> Wrote $OUT ($(du -h "$OUT" | cut -f1))"

#!/bin/bash
# Runs INSIDE the same chroot as chroot-provision.sh, a second time, after build.sh has generated
# the Prisma client, applied migrations, AND built the production bundle — all on the build HOST
# (see build.sh and chroot-provision.sh for why: Prisma has no engine binary for 32-bit ARM at
# all, and esbuild's prebuilt binary is ARMv7-only with no from-source fallback).
#
# Deliberately does NOT run prisma/seed.ts: the shipped image should have the DB schema (from
# build.sh's `migrate deploy`) but no seed data (no demo admin user, recipes, or mock device) —
# the image is meant to be flashed by strangers, and shipping a shared, publicly-known admin
# login baked into every copy would be a real credential, not a demo convenience.
set -euo pipefail

APP_DIR=/home/pi/RePicoBrew
cd "$APP_DIR"

echo "==> Cleaning up apt cache..."
apt-get clean
rm -rf /var/lib/apt/lists/*

echo "=== chroot provisioning (finish phase) complete ==="

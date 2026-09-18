#!/bin/bash
# Runs INSIDE the same chroot as chroot-provision.sh, a second time, after build.sh has generated
# the Prisma client and applied migrations from the HOST (see build.sh and chroot-provision.sh for
# why that step can't run under this chroot's ARM emulation). This script finishes the job with
# steps that must run under real ARM emulation: `db seed` loads the ARM-compiled
# better-sqlite3 native binding via the Prisma driver adapter, and `pnpm build` needs the same
# Node.js runtime the app will actually run under.
set -euo pipefail

APP_DIR=/home/pi/RePicoBrew
cd "$APP_DIR"

echo "==> Seeding database..."
# NOT `prisma db seed` — the `prisma` CLI resolves/downloads a schema-engine binary on startup
# for any subcommand, which 404s here the same way `generate`/`migrate` did (see build.sh). Run
# the configured seed command (package.json's `prisma.seed`) directly instead: it only touches
# @prisma/client via the driver adapter (engineType="client" — no engine binary involved at all).
sudo -u pi /usr/local/bin/pnpm exec tsx prisma/seed.ts

echo "==> Building production bundle..."
sudo -u pi bash -c '/usr/local/bin/pnpm build'

echo "==> Cleaning up apt cache..."
apt-get clean
rm -rf /var/lib/apt/lists/*

echo "=== chroot provisioning (finish phase) complete ==="

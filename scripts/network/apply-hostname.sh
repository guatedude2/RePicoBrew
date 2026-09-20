#!/bin/bash
# Applies a new hostname on a running Pi. Baked into the image (see pi-image/chroot-provision.sh)
# and invoked via a narrowly-scoped passwordless sudo rule (/etc/sudoers.d/repicobrew-control) from
# app/utils/network-control.server.ts — the Node process runs as the unprivileged `pi` user
# (NoNewPrivileges=true in repicobrew.service), so this script is its only path to actually rename
# the host instead of just saving the name to the database, which is all Settings/Setup did before.
set -euo pipefail

NEW_HOSTNAME="${1:-}"

if [[ ! "$NEW_HOSTNAME" =~ ^[a-z0-9-]{1,63}$ ]]; then
  echo "Invalid hostname: must be 1-63 chars, lowercase letters/digits/hyphens only" >&2
  exit 1
fi

echo "$NEW_HOSTNAME" > /etc/hostname

# Replace (or add) the 127.0.1.1 line other tools (avahi/mDNS, `hostname -f`) read the name from.
if grep -q '^127\.0\.1\.1[[:space:]]' /etc/hosts; then
  sed -i "s/^127\.0\.1\.1.*/127.0.1.1\t$NEW_HOSTNAME/" /etc/hosts
else
  printf '127.0.1.1\t%s\n' "$NEW_HOSTNAME" >> /etc/hosts
fi

hostnamectl set-hostname "$NEW_HOSTNAME"

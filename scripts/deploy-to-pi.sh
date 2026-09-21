#!/bin/bash
# shellcheck disable=SC2029,SC2087  # paths/versions are deliberately expanded on this (client) side
# Deploys RePicoBrew onto a STOCK Raspberry Pi OS Lite install flashed with Raspberry Pi Imager —
# no custom image build. Detects the target's architecture over SSH:
#
#   aarch64 (Pi 3/4/5/Zero 2 W, 64-bit OS): copies the source, installs Node.js 20 (official arm64
#       build), installs dependencies and runs the database migrations ON the Pi (it's fast enough;
#       needs internet, e.g. Ethernet), installs nginx (port 80 -> the app) and a systemd service.
#   armv6l (Pi Zero/Zero W): copies the ARMv6-compiled app tree extracted from an image built by
#       pi-image/build.sh (see pi-image/extract-app.sh) and installs the ARMv6 Node.js build —
#       nothing is compiled on the device, which is far too slow there.
#
# The app itself is always built here, on this machine. Re-running only re-syncs and restarts (the
# database is left alone) unless --fresh is passed (armv6l only: re-extracts the whole app tree).
#
# Usage: scripts/deploy-to-pi.sh <user>@<host> [--fresh]
set -euo pipefail

TARGET="${1:?usage: scripts/deploy-to-pi.sh <user>@<host> [--fresh]}"
FRESH="${2:-}"

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REMOTE_USER="${TARGET%@*}"
REMOTE_HOST="${TARGET#*@}"
REMOTE_HOME="$(ssh "$TARGET" 'echo $HOME')"
APP_DIR="$REMOTE_HOME/RePicoBrew"
ARCH="$(ssh "$TARGET" 'uname -m')"

echo "==> Target: $TARGET ($ARCH), app dir $APP_DIR"

echo "==> Building the app on this machine..."
(cd "$REPO_DIR" && HUSKY=0 pnpm build)

install_service() {
  echo "==> Installing and starting the service..."
  # Runs node directly (not `pnpm start`): one process instead of pnpm + sh + node, and no pnpm
  # needed at runtime. No PrivateTmp: wpa_cli's reply socket lives in /tmp (see
  # scripts/repicobrew.service).
  ssh "$TARGET" "sudo tee /etc/systemd/system/repicobrew.service >/dev/null" <<EOF
[Unit]
Description=RePicoBrew Server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$REMOTE_USER
Group=$REMOTE_USER
WorkingDirectory=$APP_DIR
Environment="NODE_ENV=production"
Environment="PORT=8080"
ExecStart=/usr/local/bin/node node_modules/@react-router/serve/bin.js build/server/index.js
Restart=on-failure
RestartSec=10
# The app holds open live-update (SSE) connections, so a polite SIGTERM stop can hang until systemd's
# 90s default kills it; don't make every restart wait that long.
TimeoutStopSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=repicobrew

[Install]
WantedBy=multi-user.target
EOF
  ssh "$TARGET" 'sudo systemctl daemon-reload && sudo systemctl enable repicobrew.service && sudo systemctl restart repicobrew.service'
}

install_ble_scanner() {
  echo "==> Installing the Bluetooth (Tilt) scanner service..."
  ssh "$TARGET" "sudo tee /etc/systemd/system/tilt-ble.service >/dev/null" <<EOF
[Unit]
Description=Tilt Bluetooth scanner for RePicoBrew
After=network.target repicobrew.service
# The scanner talks to the Bluetooth controller directly (raw HCI), which BlueZ would otherwise hold.
Conflicts=bluetooth.service

[Service]
Type=simple
User=$REMOTE_USER
Group=$REMOTE_USER
WorkingDirectory=$APP_DIR
Environment="NODE_ENV=production"
# Raspberry Pi OS can leave Bluetooth soft-blocked (rfkill) and the controller down; bring it up as
# root ("+") before the scanner starts. Never fails the start: the scanner retries on its own.
# ($$ = a literal $ for systemd, which otherwise expands $VARIABLES in unit lines.)
ExecStartPre=+/bin/sh -c 'for f in /sys/class/rfkill/rfkill*; do [ "\$\$(cat "\$\$f/type")" = bluetooth ] && echo 0 > "\$\$f/soft"; done; /usr/bin/hciconfig hci0 up || true'
ExecStart=/usr/local/bin/node --import tsx workers/tilt-ble.ts
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=tilt-ble
# Keep it from starving the brewing app on a 1GB Pi.
MemoryMax=150M

# Raw Bluetooth access without running as root.
AmbientCapabilities=CAP_NET_RAW CAP_NET_ADMIN
CapabilityBoundingSet=CAP_NET_RAW CAP_NET_ADMIN

[Install]
WantedBy=multi-user.target
EOF
  ssh "$TARGET" 'sudo systemctl daemon-reload && sudo systemctl enable tilt-ble.service && sudo systemctl restart tilt-ble.service'
}

deploy_aarch64() {
  local node_version="20.18.1"
  local node_url="https://nodejs.org/dist/v${node_version}/node-v${node_version}-linux-arm64.tar.gz"

  echo "==> Installing system packages (nginx, build tools for any native module fallback)..."
  ssh "$TARGET" 'sudo apt-get update -qq && sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nginx build-essential python3 rsync curl dnsmasq-base'

  echo "==> Installing Node.js ${node_version} (arm64) if missing..."
  ssh "$TARGET" "bash -s" <<EOF
set -euo pipefail
if [ ! -x /usr/local/lib/nodejs/bin/node ]; then
  curl -fsSL "$node_url" -o /tmp/node.tar.gz
  sudo mkdir -p /usr/local/lib/nodejs
  sudo tar -xzf /tmp/node.tar.gz -C /usr/local/lib/nodejs --strip-components=1
  rm /tmp/node.tar.gz
  for bin in node npm npx corepack; do sudo ln -sf /usr/local/lib/nodejs/bin/\$bin /usr/local/bin/\$bin; done
fi
# The corepack bundled with older Node 20 releases has stale npm signing keys and fails to download
# pnpm ("Cannot find matching keyid"); corepack >= 0.31 has the current keys.
if ! corepack --version | awk -F. '{ exit !((\$1 > 0) || (\$2 >= 31)) }'; then
  sudo npm install -g --force corepack@latest
fi
sudo corepack enable
node --version
EOF

  echo "==> Syncing source (data/ holds the recipe libraries, ~60MB on first sync)..."
  ssh "$TARGET" "mkdir -p '$APP_DIR'"
  rsync -az --delete \
    --exclude='/.git' --exclude='/node_modules' --exclude='/build' --exclude='/pi-image' \
    --exclude='/.react-router' --exclude='/prisma/*.db*' --exclude='/prisma/*.sql' \
    --exclude='/manuals-cache' --exclude='/public/recipe-photos/*' --exclude='.DS_Store' \
    "$REPO_DIR/" "$TARGET:$APP_DIR/"

  echo "==> Installing dependencies and applying database migrations on the Pi (a few minutes)..."
  # Stop the app first on re-deploys: while it has the SQLite file open, `migrate deploy` fails with
  # "database is locked". install_service restarts it at the end.
  ssh "$TARGET" 'sudo systemctl stop repicobrew.service 2>/dev/null || true'
  ssh "$TARGET" "cd '$APP_DIR' && HUSKY=0 pnpm install --frozen-lockfile && pnpm exec prisma migrate deploy"

  echo "==> Syncing the production bundle..."
  rsync -az --delete "$REPO_DIR/build/" "$TARGET:$APP_DIR/build/"

  echo "==> Configuring nginx (port 80 -> app on 8080, with a friendly page while the app starts)..."
  ssh "$TARGET" "sudo mkdir -p /var/www/repicobrew && sudo install -m 0644 '$APP_DIR/scripts/starting.html' /var/www/repicobrew/repicobrew-starting.html"
  ssh "$TARGET" "sudo rm -f /etc/nginx/sites-enabled/default && sudo ln -sf '$APP_DIR/scripts/nginx-picobrew.conf' /etc/nginx/sites-enabled/picobrew && sudo nginx -t && sudo systemctl enable nginx && sudo systemctl restart nginx"

  echo "==> Installing network scripts and sudo rules (so Settings/Setup can apply the AP and hostname)..."
  ssh "$TARGET" "sudo mkdir -p /usr/local/sbin/repicobrew-network && sudo install -m 0755 -o root -g root '$APP_DIR'/scripts/network/{apply-hostname,apply-ap,apply-wifi,setup-nm-ap,check-updates,start-updates,power}.sh /usr/local/sbin/repicobrew-network/"
  ssh "$TARGET" "sudo tee /etc/sudoers.d/repicobrew-control >/dev/null && sudo chmod 0440 /etc/sudoers.d/repicobrew-control && sudo visudo -cf /etc/sudoers.d/repicobrew-control" <<EOF
$REMOTE_USER ALL=(root) NOPASSWD: /usr/local/sbin/repicobrew-network/power.sh restart
$REMOTE_USER ALL=(root) NOPASSWD: /usr/local/sbin/repicobrew-network/power.sh reboot
$REMOTE_USER ALL=(root) NOPASSWD: /usr/local/sbin/repicobrew-network/power.sh shutdown
$REMOTE_USER ALL=(root) NOPASSWD: /usr/local/sbin/repicobrew-network/check-updates.sh
$REMOTE_USER ALL=(root) NOPASSWD: /usr/local/sbin/repicobrew-network/start-updates.sh
$REMOTE_USER ALL=(root) NOPASSWD: /usr/local/sbin/repicobrew-network/apply-hostname.sh *
$REMOTE_USER ALL=(root) NOPASSWD: /usr/local/sbin/repicobrew-network/apply-ap.sh *
$REMOTE_USER ALL=(root) NOPASSWD: /usr/local/sbin/repicobrew-network/apply-wifi.sh *
EOF

  # Private web search for the AI Brewmaster: a local-only SearXNG instance. Installed once (10-20 min);
  # later deploys skip it.
  if ssh "$TARGET" 'test -x /opt/searxng/venv/bin/python && systemctl is-active --quiet searxng'; then
    echo "==> SearXNG (AI web search) already installed."
  else
    echo "==> Installing SearXNG for the AI Brewmaster's web search (10-20 minutes the first time)..."
    ssh "$TARGET" "APP_DIR='$APP_DIR' bash -s" <"$REPO_DIR/scripts/setup-searxng.sh"
  fi

  install_service
  install_ble_scanner
}

deploy_armv6l() {
  local bundle="$REPO_DIR/pi-image/work/repicobrew-app-armv6.tgz"
  local node_version="20.9.0"
  local node_url="https://unofficial-builds.nodejs.org/download/release/v${node_version}/node-v${node_version}-linux-armv6l.tar.gz"

  if [ ! -f "$bundle" ]; then
    echo "Missing $bundle — run pi-image/extract-app.sh against a built image first." >&2
    exit 1
  fi

  local remote_has_app
  remote_has_app="$(ssh "$TARGET" "test -d '$APP_DIR' && echo yes || echo no")"
  if [ "$remote_has_app" = "no" ] || [ "$FRESH" = "--fresh" ]; then
    echo "==> Copying the app tree (node_modules with ARMv6 native modules)..."
    scp "$bundle" "$TARGET:/tmp/repicobrew-app.tgz"
    ssh "$TARGET" "sudo systemctl stop repicobrew.service 2>/dev/null || true; rm -rf '$APP_DIR' && tar xzf /tmp/repicobrew-app.tgz -C '$REMOTE_HOME' && rm /tmp/repicobrew-app.tgz"
  fi

  echo "==> Installing Node.js ${node_version} (ARMv6 build) if missing..."
  ssh "$TARGET" "bash -s" <<EOF
set -euo pipefail
if [ ! -x /usr/local/lib/nodejs/bin/node ]; then
  curl -fsSL "$node_url" -o /tmp/node.tar.gz
  sudo mkdir -p /usr/local/lib/nodejs
  sudo tar -xzf /tmp/node.tar.gz -C /usr/local/lib/nodejs --strip-components=1
  rm /tmp/node.tar.gz
  sudo ln -sf /usr/local/lib/nodejs/bin/node /usr/local/bin/node
fi
node --version
EOF

  echo "==> Syncing the production bundle..."
  rsync -az --delete "$REPO_DIR/build/" "$TARGET:$APP_DIR/build/"

  install_service
}

case "$ARCH" in
  aarch64) deploy_aarch64 ;;
  armv6l) deploy_armv6l ;;
  *)
    echo "Unsupported architecture '$ARCH' (expected aarch64 or armv6l)." >&2
    exit 1
    ;;
esac

echo "==> Done. Give it a minute to start, then open http://${REMOTE_HOST}/ (or :8080 directly)."

#!/bin/bash
# Installs a private SearXNG metasearch instance ON the Pi (no Docker) for the AI Brewmaster's web
# lookups, for the app to use by default. Listens on 127.0.0.1:8888 only — nothing outside the Pi can reach it.
# Idempotent: re-running updates the checkout and restarts the service.
#
# Usage (on the Pi, as a user with sudo):  bash setup-searxng.sh
# Takes 10-20 minutes on a Pi 4 (Python dependencies are installed into a virtualenv).
set -euo pipefail

INSTALL_DIR=/opt/searxng
SETTINGS_DIR=/etc/searxng
PORT=8888

echo "==> Installing system packages..."
sudo apt-get update -qq
sudo apt-get install -y -qq git python3-venv python3-dev build-essential libxslt1-dev zlib1g-dev libffi-dev libssl-dev

echo "==> Creating the searxng user and fetching the source..."
id searxng >/dev/null 2>&1 || sudo useradd --system --home-dir "$INSTALL_DIR" --shell /usr/sbin/nologin searxng
sudo mkdir -p "$INSTALL_DIR"
if [ -d "$INSTALL_DIR/src/.git" ]; then
  sudo git -C "$INSTALL_DIR/src" pull --ff-only -q
else
  sudo git clone --depth 1 -q https://github.com/searxng/searxng "$INSTALL_DIR/src"
fi
sudo chown -R searxng:searxng "$INSTALL_DIR"

echo "==> Installing SearXNG into a virtualenv (slow on a Pi)..."
sudo -u searxng python3 -m venv "$INSTALL_DIR/venv"
sudo -u searxng "$INSTALL_DIR/venv/bin/pip" install -q -U pip setuptools wheel pyyaml msgspec typing_extensions pybind11
sudo -u searxng bash -c "cd '$INSTALL_DIR/src' && '$INSTALL_DIR/venv/bin/pip' install -q --use-pep517 --no-build-isolation -e ."

echo "==> Writing the configuration..."
sudo mkdir -p "$SETTINGS_DIR"
if [ ! -f "$SETTINGS_DIR/settings.yml" ]; then
  SECRET=$(openssl rand -hex 32)
  sudo tee "$SETTINGS_DIR/settings.yml" >/dev/null <<EOF
use_default_settings: true
server:
  bind_address: "127.0.0.1"
  port: $PORT
  secret_key: "$SECRET"
  limiter: false
  image_proxy: false
search:
  formats:
    - html
    - json
EOF
fi
sudo chown -R searxng:searxng "$SETTINGS_DIR"
sudo chmod 640 "$SETTINGS_DIR/settings.yml"

echo "==> Installing the service..."
sudo tee /etc/systemd/system/searxng.service >/dev/null <<EOF
[Unit]
Description=SearXNG (private metasearch for RePicoBrew's AI lookups)
After=network.target

[Service]
Type=simple
User=searxng
Group=searxng
Environment=SEARXNG_SETTINGS_PATH=$SETTINGS_DIR/settings.yml
ExecStart=$INSTALL_DIR/venv/bin/python -m searx.webapp
WorkingDirectory=$INSTALL_DIR/src
Restart=on-failure
RestartSec=10
# Keep it from starving the brewing app on a 1GB Pi.
MemoryMax=300M
Nice=10

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now searxng.service
sudo systemctl restart searxng.service

echo "==> Waiting for SearXNG to answer..."
for _ in $(seq 1 45); do
  if curl -fs -m 5 "http://127.0.0.1:$PORT/search?q=test&format=json" | grep -q '"results"'; then
    echo "SearXNG is up."
    break
  fi
  sleep 2
done
curl -fs -m 10 "http://127.0.0.1:$PORT/search?q=test&format=json" | grep -q '"results"' || {
  echo "SearXNG did not answer with JSON results; see: journalctl -u searxng" >&2
  exit 1
}

echo "==> Done. Web search is on for the AI Brewmaster (the app uses http://127.0.0.1:$PORT by default; override with SEARXNG_URL)."

# Raspberry Pi Deployment Guide

Deploy RePicoBrew on a Raspberry Pi as a WiFi Access Point that spoofs `picobrew.com` for Pico C brew sessions.

## Prerequisites

- Raspberry Pi (Zero W, 3, 4, or 5) running Raspberry Pi OS (Debian-based)
- WiFi adapter (built-in on most models)
- Ethernet or second WiFi adapter for internet connectivity (optional, for initial setup)
- Node.js 18+ and pnpm installed
- Root/sudo access

## Architecture

```
Pico C Device
    ↓ (WiFi: SSID "PICOBREW")
Raspberry Pi AP (192.168.72.1)
    ↓ dnsmasq: picobrew.com → 192.168.72.1
    ↓ nginx :80
    ↓ Remix app :8080
    ↓ SQLite database
```

## Quick Start

```bash
# 1. Clone and install
cd /home/pi
git clone <your-repo-url> RePicoBrew
cd RePicoBrew
pnpm install
pnpm build

# 2. Setup WiFi AP and DNS
sudo bash scripts/setup-pi-ap.sh

# 3. Configure nginx
sudo cp scripts/nginx-picobrew.conf /etc/nginx/sites-available/picobrew
sudo ln -s /etc/nginx/sites-available/picobrew /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# 4. Install systemd service
sudo cp scripts/repicobrew.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable repicobrew
sudo systemctl start repicobrew

# 5. Check status
sudo systemctl status repicobrew
curl http://localhost:8080/
```

## Step-by-Step Setup

### 1. Install Dependencies

```bash
# Update system
sudo apt update
sudo apt upgrade -y

# Install Node.js 18+ (if not already installed)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install pnpm
curl -fsSL https://get.pnpm.io/install.sh | sh -
source ~/.bashrc

# Install networking tools
sudo apt install -y hostapd dnsmasq nginx

# Stop services while we configure
sudo systemctl stop hostapd
sudo systemctl stop dnsmasq
sudo systemctl stop nginx
```

### 2. Configure WiFi Access Point

The setup script configures:

- **SSID:** `PICOBREW`
- **Password:** `picobrew123`
- **IP Range:** `192.168.72.0/24`
- **Gateway:** `192.168.72.1`

Edit `scripts/setup-pi-ap.sh` if you want to customize these values, then run:

```bash
sudo bash scripts/setup-pi-ap.sh
```

This script will:

- Configure hostapd (WiFi AP)
- Setup dnsmasq (DHCP + DNS)
- Configure DNS to resolve `picobrew.com` → `192.168.72.1`
- Setup network bridge if needed
- Enable IP forwarding (if you want internet sharing)

**Manual verification:**

```bash
# Check hostapd
sudo systemctl status hostapd

# Check dnsmasq
sudo systemctl status dnsmasq
sudo cat /etc/dnsmasq.d/picobrew.conf

# Test DNS from another device on the AP
# (connect to PICOBREW network, then):
nslookup picobrew.com
# Should return 192.168.72.1
```

### 3. Configure Nginx Reverse Proxy

Nginx terminates HTTP on port 80 and proxies to Remix on port 8080.

```bash
# Copy nginx config
sudo cp scripts/nginx-picobrew.conf /etc/nginx/sites-available/picobrew
sudo ln -s /etc/nginx/sites-available/picobrew /etc/nginx/sites-enabled/

# Remove default site (optional)
sudo rm /etc/nginx/sites-enabled/default

# Test config
sudo nginx -t

# Enable and start
sudo systemctl enable nginx
sudo systemctl start nginx
```

Test from the Pi itself:

```bash
curl http://localhost/
curl http://picobrew.com/
```

### 4. Install Application

```bash
cd /home/pi/RePicoBrew

# Install dependencies
pnpm install

# Generate Prisma client
pnpm exec prisma generate

# Run database migrations (if any)
pnpm exec prisma migrate deploy

# Seed database with default recipes and config
pnpm exec prisma db seed

# Build production bundle
pnpm build
```

### 5. Setup Systemd Service

```bash
# Copy service file
sudo cp scripts/repicobrew.service /etc/systemd/system/

# Reload systemd
sudo systemctl daemon-reload

# Enable auto-start on boot
sudo systemctl enable repicobrew

# Start service
sudo systemctl start repicobrew

# Check status
sudo systemctl status repicobrew

# View logs
sudo journalctl -u repicobrew -f
```

### 6. Verify End-to-End

From a device connected to the `PICOBREW` WiFi:

```bash
# DNS resolution
nslookup picobrew.com
# Should return 192.168.72.1

# HTTP access
curl http://picobrew.com/
# Should return HTML from Remix

# Test Pico API endpoint
curl "http://picobrew.com/API/pico/register?uid=test12345678901234567890123456789012"
# Should return #F# (device not registered yet)
```

Open browser: `http://picobrew.com/` or `http://192.168.72.1/`

Login with default credentials (see prisma seed):

- Email: `admin@repicobrew.local`
- Password: `admin`

### 7. Connect Your Pico

1. Power on your Pico C
2. Configure Pico to join WiFi network: **SSID:** `PICOBREW`, **Password:** `picobrew123`
3. Pico will resolve `picobrew.com` and call `/API/pico/register`
4. In the RePicoBrew UI (Settings → Devices), approve the new device
5. Create or edit a recipe
6. On the Pico, select the recipe and start brewing
7. Watch live progress on the Dashboard

## Maintenance

### Update Application

```bash
cd /home/pi/RePicoBrew
git pull
pnpm install
pnpm build
sudo systemctl restart repicobrew
```

### View Logs

```bash
# Systemd service logs
sudo journalctl -u repicobrew -f

# Nginx access logs
sudo tail -f /var/log/nginx/picobrew-access.log

# Nginx error logs
sudo tail -f /var/log/nginx/picobrew-error.log

# dnsmasq logs
sudo journalctl -u dnsmasq -f
```

### Database Location

SQLite database: `/home/pi/RePicoBrew/prisma/picobrew.db`

Backup:

```bash
cp /home/pi/RePicoBrew/prisma/picobrew.db /home/pi/backup-$(date +%Y%m%d).db
```

## Troubleshooting

### Pico can't connect to WiFi

- Verify SSID and password in hostapd config
- Check `sudo systemctl status hostapd`
- Check WiFi interface is not managed by NetworkManager: `nmcli device status`

### DNS not resolving picobrew.com

- Check dnsmasq: `sudo systemctl status dnsmasq`
- Verify `/etc/dnsmasq.d/picobrew.conf` contains `address=/picobrew.com/192.168.72.1`
- Test from Pi: `dig @192.168.72.1 picobrew.com`

### Pico can reach DNS but not HTTP

- Check nginx: `sudo systemctl status nginx`
- Check nginx is listening: `sudo netstat -tlnp | grep :80`
- Test locally: `curl http://localhost/API/pico/register?uid=test`

### Application won't start

- Check logs: `sudo journalctl -u repicobrew -f`
- Verify Node version: `node --version` (should be 18+)
- Check port 8080 not in use: `sudo netstat -tlnp | grep :8080`
- Run manually to see errors: `cd /home/pi/RePicoBrew && pnpm start`

### Database errors

- Check permissions: `ls -la /home/pi/RePicoBrew/prisma/picobrew.db`
- Regenerate client: `pnpm exec prisma generate`
- Reset database (WARNING: deletes data): `rm prisma/picobrew.db && pnpm exec prisma migrate deploy && pnpm exec prisma db seed`

## Security Notes

- Default WiFi password is `picobrew123` - change it in the setup script
- Default admin credentials should be changed after first login
- The AP is isolated from your main network by default
- Enable firewall rules if exposing to internet (not recommended for Pico use)

## Advanced: Internet Sharing

To share your Pi's ethernet connection with Pico devices on the AP:

```bash
# Enable IP forwarding (already in setup script)
sudo sysctl -w net.ipv4.ip_forward=1

# Setup NAT (adjust eth0 to your internet interface)
sudo iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
sudo iptables -A FORWARD -i wlan0 -o eth0 -j ACCEPT
sudo iptables -A FORWARD -i eth0 -o wlan0 -m state --state RELATED,ESTABLISHED -j ACCEPT

# Make persistent
sudo apt install -y iptables-persistent
sudo netfilter-persistent save
```

---

## Phase 2: Tilt Hydrometer Support (Bluetooth)

### Overview

RePicoBrew can monitor Tilt wireless hydrometers during fermentation using Bluetooth Low Energy (BLE) on the Raspberry Pi.

**Supported Tilt colors:** Red, Green, Black, Purple, Orange, Blue, Yellow, Pink

### Prerequisites

- Raspberry Pi with Bluetooth support (Pi 3, 4, 5, or Zero W)
- Tilt Hydrometer (any color)
- Bluetooth enabled on the Pi

### 1. Enable Bluetooth

```bash
# Check Bluetooth status
sudo systemctl status bluetooth

# Enable if not already running
sudo systemctl enable bluetooth
sudo systemctl start bluetooth

# Verify Bluetooth adapter
hciconfig
# Should show hci0 in UP RUNNING state
```

### 2. Install Noble Dependencies

```bash
# Install required system libraries for BLE
sudo apt install -y bluetooth bluez libbluetooth-dev libudev-dev

# Grant Node.js BLE permissions (avoids running as root)
sudo setcap cap_net_raw+eip $(eval readlink -f `which node`)
```

### 3. Install Node.js Dependencies

The `@stoprocent/noble` package is already in `package.json`. Reinstall if needed:

```bash
cd /home/pi/RePicoBrew
pnpm install
```

### 4. Setup Tilt BLE Worker Service

Create a systemd service for the Tilt BLE scanner:

```bash
# Copy service file
sudo cp scripts/tilt-ble.service /etc/systemd/system/

# Reload systemd
sudo systemctl daemon-reload

# Enable auto-start on boot
sudo systemctl enable tilt-ble

# Start service
sudo systemctl start tilt-ble

# Check status
sudo systemctl status tilt-ble

# View logs
sudo journalctl -u tilt-ble -f
```

### 5. Verify Tilt Detection

Power on your Tilt hydrometer (place in water or beer) and check the logs:

```bash
sudo journalctl -u tilt-ble -f
```

Expected output:

```
[Tilt BLE] Starting BLE scan for Tilt hydrometers...
[Tilt BLE] Bluetooth state: poweredOn
[Tilt BLE] Scan started. Waiting for Tilt devices...
[Tilt BLE] Black: SG 1050, Temp 68.0°F, RSSI -67dBm
```

### 6. Register Tilt in UI

1. Open RePicoBrew UI at `http://picobrew.com/` or `http://192.168.72.1/`
2. Go to **Settings → Devices**
3. Wait for Tilt to be auto-detected (check logs or wait for UI notification)
4. Click **Add Device** if needed
5. Enter Tilt UID (e.g., `BlackA1B2C3D4E5F6`) and alias (e.g., "Fermenter 1")
6. Click **Approve Device**

### 7. Start Fermentation Tracking

1. Go to **Fermentation** page in the UI
2. Select your Tilt from the dropdown
3. Click **Start Tracking**
4. Monitor live gravity and temperature updates
5. Click **Stop Tracking** when fermentation is complete

### 8. Alternative: HTTP POST Method (for Testing)

If you prefer to use an external tool like [pytilt](https://github.com/rbauststfc/pytilt), you can POST readings directly to the API:

```bash
# Install pytilt on another device
pip install pytilt

# Configure to POST to RePicoBrew
pytilt --device BlackTilt --url http://192.168.72.1/API/tilt --interval 60
```

RePicoBrew's `/API/tilt` endpoint accepts:

```json
[
  {
    "color": "Black",
    "temp": 20.0,
    "gravity": 1050,
    "timestamp": "2024-01-01T00:00:00Z",
    "uid": "BlackA1B2C3D4E5F6",
    "rssi": -67
  }
]
```

**Note:** Temperature from pytilt is in Celsius and will be converted to Fahrenheit automatically.

### Troubleshooting Tilt

#### Tilt not detected

```bash
# Check Bluetooth is powered on
sudo bluetoothctl
# > power on
# > scan on
# Wait 30 seconds, you should see iBeacon advertisements

# Check tilt-ble service is running
sudo systemctl status tilt-ble

# Check for permission errors
sudo journalctl -u tilt-ble -f
# If you see "Operation not permitted", run:
sudo setcap cap_net_raw+eip $(eval readlink -f `which node`)
sudo systemctl restart tilt-ble
```

#### Readings not appearing in UI

- Verify a fermentation session is **started** (Tilt readings are only logged during active sessions)
- Check SSE connection: Open browser console, look for `/api/events` connection
- Check logs: `sudo journalctl -u tilt-ble -u repicobrew -f`

#### Multiple Tilts

- Each Tilt has a unique color/MAC UID
- Register each one separately in Settings → Devices
- Start separate fermentation sessions for each Tilt
- The BLE worker scans for all colors simultaneously

### Performance Notes

- BLE scanning runs continuously in the background
- Readings are throttled to every 5 seconds per Tilt to avoid spamming
- RSSI (signal strength) is logged for debugging range issues
- Noble may report "warning: unknown peripheral" for non-Tilt devices — this is normal

---

Use this checklist to verify the complete brew-and-track flow on your Raspberry Pi:

### 1. Pre-Flight Checks

- [ ] Pi is running and accessible via SSH
- [ ] WiFi AP `PICOBREW` is broadcasting
- [ ] DNS resolves `picobrew.com` to `192.168.72.1` (test with `dig @192.168.72.1 picobrew.com`)
- [ ] nginx is running and proxying to port 8080
- [ ] RePicoBrew service is running (`sudo systemctl status repicobrew`)
- [ ] Database exists at `/home/pi/RePicoBrew/prisma/picobrew.db`
- [ ] At least one recipe exists in the database

### 2. UI Access Test

From a device connected to the `PICOBREW` network:

- [ ] Open browser to `http://picobrew.com/` or `http://192.168.72.1/`
- [ ] Login page appears
- [ ] Can log in with admin credentials
- [ ] Dashboard loads without errors
- [ ] Navigation works (Dashboard, Sessions, Recipes, Settings)

### 3. Device Registration

- [ ] Power on your Pico C
- [ ] Pico connects to `PICOBREW` WiFi (check Pico screen)
- [ ] Check RePicoBrew logs: `sudo journalctl -u repicobrew -f`
- [ ] Look for `/API/pico/register` request in logs
- [ ] Toast notification appears in UI about unregistered device
- [ ] Go to Settings → Devices
- [ ] Click "Add Device"
- [ ] Enter the UID from the logs and a device name
- [ ] Click "Approve Device"
- [ ] Device appears in the device list
- [ ] Pico shows recipe list on screen (if recipes exist)

### 4. Recipe Management

- [ ] Go to Recipes page
- [ ] Click "New Recipe"
- [ ] Enter recipe details (name, ABV, IBU, style)
- [ ] Verify first 3 steps are locked (yellow background)
- [ ] Add/remove steps after step 3
- [ ] Click "Create Recipe"
- [ ] Recipe appears in recipe list
- [ ] Click "Edit" on a recipe
- [ ] Make changes and save
- [ ] Changes persist after reload

### 5. Live Brew Session

**Start Brew:**

- [ ] On Pico device, select a recipe
- [ ] Press start/brew on Pico
- [ ] Pico begins heating

**Monitor Dashboard:**

- [ ] Refresh Dashboard in browser
- [ ] Active brew card appears
- [ ] Recipe name and device name are correct
- [ ] BrewingAnimation shows current phase
- [ ] Current step displays correctly
- [ ] Wort and Therm temperatures display
- [ ] Time remaining counts down
- [ ] Progress bar moves
- [ ] Step timeline highlights current step

**Watch Live Updates:**

- [ ] Keep Dashboard open
- [ ] As Pico progresses through steps, UI updates automatically (no manual refresh)
- [ ] Animation phases change: PREPARING → HEATING → MASHING → BOILING → BITTERING
- [ ] Temperatures update in real-time
- [ ] Events appear when steps change
- [ ] Timeline steps highlight as they become active

**Brew Completion:**

- [ ] When last step completes, session state changes to "Complete"
- [ ] Dashboard shows completion status
- [ ] Session appears in Sessions history

### 6. Session History

- [ ] Go to Sessions page
- [ ] Find the completed session in the list
- [ ] Click "View" on the session
- [ ] Session detail page loads
- [ ] Temperature graph displays wort and therm over time
- [ ] Brew timeline shows all steps with timestamps
- [ ] Events are listed in chronological order

### 7. Log Comparison (Advanced)

Compare your live session against the reference [`test.log`](test.log):

```bash
# On Pi, check recent API calls
sudo journalctl -u repicobrew --since "10 minutes ago" | grep "/API/pico"

# Should see sequence:
# - register
# - checkFirmware
# - getActionsNeeded
# - getAssociatedPaks
# - getRecipe
# - log (repeated many times)
# - log with step containing "complete"
```

Expected call pattern:

1. `register?uid=<32-char-hex>` → returns `#T#`
2. `checkFirmware?uid=...&version=...` → returns `#F#` (no update needed)
3. `getActionsNeeded?uid=...` → returns `##` (no actions)
4. `getAssociatedPaks?uid=...` → returns recipe list
5. `getRecipe?uid=...&rfid=<14-char>&ibu=-1&abv=-1.0` → returns recipe program
6. `log?uid=...&sesId=<rfid>&wort=74&therm=215&step=Preparing%20To%20Brew&...` (repeated)
7. Step progresses: Heating → Dough In → Mash → Hops → complete

### 8. Error Scenarios

Test error handling:

- [ ] **Unregistered device**: Power on unregistered Pico → register returns `#F#` → no recipe list
- [ ] **No recipes**: Approve device but delete all recipes → Pico shows empty list
- [ ] **Network disconnect**: Disconnect Pico from WiFi during brew → reconnect → brew continues
- [ ] **Server restart**: Restart RePicoBrew during brew → `sudo systemctl restart repicobrew` → session persists

### 9. Performance Checks

- [ ] Log entries write without noticeable delay
- [ ] Dashboard SSE updates arrive within 1-2 seconds
- [ ] No memory leaks after 30+ minute brew session
- [ ] Database size is reasonable (< 100MB after multiple brews)

### 10. Smoke Test Script

Quick automated verification:

```bash
#!/bin/bash
# smoke-test.sh

echo "Testing DNS..."
nslookup picobrew.com 192.168.72.1 || exit 1

echo "Testing HTTP..."
curl -s http://picobrew.com/ | grep -q "RePicoBrew" || exit 1

echo "Testing Pico API..."
curl -s "http://picobrew.com/API/pico/register?uid=test12345678901234567890123456789012" | grep -q "#" || exit 1

echo "Testing SSE endpoint..."
timeout 2 curl -s http://picobrew.com/api/events || echo "SSE endpoint responding"

echo "All smoke tests passed!"
```

Run with: `bash smoke-test.sh`

---

**Pass Criteria:**

All steps in sections 1-6 complete successfully = **Phase 1 is production-ready for Pico C brewing**

If any step fails, check:

- Logs: `sudo journalctl -u repicobrew -u nginx -u dnsmasq -f`
- Nginx config: `sudo nginx -t`
- Service status: `sudo systemctl status repicobrew nginx dnsmasq`
- Network: `ip addr`, `iwconfig`, `hostapd_cli status`

## References

- [chiefwigms/picobrew_pico](https://github.com/chiefwigms/picobrew_pico) - Original Python reference implementation
- [Remix Docs](https://remix.run/docs) - Remix framework documentation
- [Raspberry Pi AP Guide](https://www.raspberrypi.org/documentation/configuration/wireless/access-point-routed.md)
- Phase 1 Plan: See `.cursor/plans/pico_phase_1_plan_*.plan.md` for detailed implementation notes

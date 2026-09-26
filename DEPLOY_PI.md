# Raspberry Pi Deployment Guide

RePicoBrew runs on a Raspberry Pi that broadcasts its own `PICOBREW` Wi-Fi network and answers the PicoBrew
machines' calls to `picobrew.com`.

There are two ways to get it onto a Pi:

- **Flash the ready-made image** (recommended): download it from the
  [releases page](https://github.com/guatedude2/RePicoBrew/releases), flash it with Raspberry Pi Imager and
  boot. See [pi-image/README.md](pi-image/README.md).
- **Install on a Pi you already have**, using `scripts/deploy-to-pi.sh` from your computer. That's what this
  guide covers.

## What you need

- A Raspberry Pi 3, 4, 5 or Zero 2 W running **Raspberry Pi OS Lite (64-bit)**, Bookworm or newer, flashed with
  [Raspberry Pi Imager](https://www.raspberrypi.com/software/). In Imager's OS customisation, set a user and
  password and turn on **SSH**. The 32-bit Pi Zero W/Zero/1 is not supported.
- **Internet on the Pi through Ethernet or a USB Wi-Fi adapter.** The built-in Wi-Fi radio becomes the
  `PICOBREW` access point, so it can't also join your home network.
- A computer (macOS or Linux) with this repo checked out, Node.js 20+ and pnpm, and SSH access to the Pi
  (`ssh-copy-id pi@<pi-address>` saves typing the password on every step).

## How it fits together

```
Pico / Zymatic / Z Series / PicoFerm
    ↓ Wi-Fi "PICOBREW" (NetworkManager hotspot, 192.168.72.1)
    ↓ DNS: picobrew.com → 192.168.72.1
nginx :80  →  RePicoBrew app :8080  →  SQLite (prisma/picobrew.db)
tilt-ble service  →  Tilt hydrometers over Bluetooth
```

## Install

From the repo on your computer:

```bash
scripts/deploy-to-pi.sh pi@<pi-address>
```

The script builds the app on your computer, then over SSH:

1. installs nginx, Node.js 20 and pnpm on the Pi;
2. copies the source and the production build, installs dependencies and applies database migrations;
3. sets up nginx (port 80 → the app, with a "starting" page while it boots);
4. installs the network helper scripts and a narrow sudo rule so Settings can change the access point,
   hostname and Wi-Fi, and restart, reboot or update the Pi;
5. installs SearXNG, the private web search the AI Brewmaster uses (10–20 minutes the first time only);
6. installs and starts the `repicobrew`, `tilt-ble` and `wlan1-watchdog` services.

The first run takes a while; later runs only re-sync and restart, and never touch the database.

## First-time setup

Open `http://<pi-address>/`. With no accounts yet, it goes to the **setup wizard**, where you:

- create the admin account;
- name the device (hostname);
- set the access point name and password (default `PICOBREW` / `picobrew123`). Finishing the wizard creates
  the `PICOBREW` network;
- optionally join a home Wi-Fi network with a second, USB Wi-Fi radio.

Then point each PicoBrew machine at the `PICOBREW` network and pair it in **Settings → Devices**.

## Updating

Pull the latest code on your computer and run the deploy script again:

```bash
git pull
scripts/deploy-to-pi.sh pi@<pi-address>
```

It refuses to run while a brew is in progress, because restarting the app would drop the machine's readings
for a few seconds. Pass `--force` to override.

**Settings → System** can restart the app, reboot or shut down the Pi, and install operating system updates.

## Day-to-day operations

```bash
# App logs
sudo journalctl -u repicobrew -f

# Tilt scanner logs
sudo journalctl -u tilt-ble -f

# nginx logs
sudo tail -f /var/log/nginx/picobrew-access.log /var/log/nginx/picobrew-error.log

# Access point status
nmcli connection show picobrew-ap
```

The database is `~/RePicoBrew/prisma/picobrew.db`. It runs in WAL mode, so back it up with SQLite's backup
command rather than copying the file while the app is running:

```bash
cd ~/RePicoBrew && node -e "require('better-sqlite3')('prisma/picobrew.db').backup('../picobrew-backup-$(date +%Y%m%d).db').then(() => console.log('done'))"
```

**Forgot your password?** On the Pi, run `cd ~/RePicoBrew && node scripts/reset-password.mjs`. The sign-in
page's "Forgot password?" link shows the same steps.

## Tilt hydrometers

The deploy script installs the `tilt-ble` service, which listens for Tilts over Bluetooth and sends their
readings to the app. Power on the Tilt (it only broadcasts while floating in liquid), then pick it for a
session's fermentation in the app.

If no readings arrive:

```bash
sudo systemctl status tilt-ble
sudo journalctl -u tilt-ble -f     # should show lines like "Logged reading for Black: SG 1.017, 70.0°F"
```

If the log shows "Operation not permitted", Node lost its Bluetooth permission (for example after a Node.js
upgrade). Restore it with:

```bash
sudo setcap cap_net_raw+eip "$(readlink -f "$(which node)")"
sudo systemctl restart tilt-ble
```

Bluetooth can also be switched off in **Settings → Devices**, which stops the scanner.

## Troubleshooting

**The PicoBrew machine can't join `PICOBREW`**

- Check the network exists: `nmcli connection show --active` should list `picobrew-ap`.
- The machines only use 2.4 GHz. The access point picks the quietest of channels 1, 6 and 11 when it's
  created; saving the access point settings in Settings again re-picks it.

**The machine joins but can't reach the app**

- DNS: from a device on `PICOBREW`, `nslookup picobrew.com` should return `192.168.72.1`. The rule lives in
  `/etc/NetworkManager/dnsmasq-shared.d/picobrew.conf`.
- nginx: `sudo systemctl status nginx`, and `curl http://localhost/` on the Pi should return the app.

**The app won't start**

- `sudo journalctl -u repicobrew -n 100` shows why.
- Run it by hand to see errors directly: `cd ~/RePicoBrew && pnpm start`.

**The AI features can't reach the internet**

- The Pi needs an uplink besides the access point: Ethernet, or a USB Wi-Fi adapter joined to your home
  network in Settings → Wi-Fi. Check with `ip route` (there should be a `default` route).

## Security notes

- Change the access point password in the setup wizard or Settings; the default is public knowledge.
- Everything runs over plain HTTP on the Pi's own network. Don't expose it to the internet.
- The app's sudo access is limited to the fixed scripts in `/usr/local/sbin/repicobrew-network/` (see
  `/etc/sudoers.d/repicobrew-control`).

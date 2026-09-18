# Building a RePicoBrew Raspberry Pi image

Produces a ready-to-flash `.img` that boots straight into the WiFi-AP + RePicoBrew setup
documented in [`../DEPLOY_PI.md`](../DEPLOY_PI.md), instead of running that guide by hand.

**Status: the offline customize step (download, resize, file staging) has been run end-to-end
successfully. `pi-image/provision.sh` — everything that happens on the Pi's real first boot —
has NOT been run on real hardware yet.** See "Known risks" below before you rely on it.

## What it does, and why almost everything happens on first boot, not at build time

`build.sh` runs inside a small Linux container (see `Dockerfile`), using `libguestfs`'s
`virt-customize`/`virt-resize` to edit a downloaded Raspberry Pi OS image's filesystem directly —
no emulated boot, no real Pi hardware involved, for this part. At build time it:

1. Downloads Raspberry Pi OS **Lite, Bullseye** (2023-05-03) for the target architecture.
2. Grows the image and root filesystem (+4GiB by default) to leave room for `node_modules`.
3. Copies this repo's current working tree (`rsync`, excluding `node_modules`/`.git`/build
   output) onto the image at `/home/pi/RePicoBrew` — whatever's on disk when you run this,
   including uncommitted changes, not just the last commit.
4. Installs a `repicobrew-firstboot` systemd service via a plain symlink (`--link`, not
   `systemctl enable` — see below for why) that will run `pi-image/provision.sh` once, the first
   time the Pi actually boots.

That's _all_ it does offline. Installing Node.js/pnpm/nginx/hostapd/dnsmasq/Bluetooth, running
`scripts/setup-pi-ap.sh`, every `systemctl enable`, and the app's own `pnpm install && pnpm build`
all happen for real inside `provision.sh`, on the Pi's own first boot — not here.

This isn't just "the build would be slow otherwise" — it's a hard limitation. `virt-customize
--run-command` (and `--install`, which is the same mechanism) **refuses to execute anything**
when the appliance's own CPU architecture doesn't match the guest image's:

```
virt-customize: error: host cpu (aarch64) and guest arch (arm) are not compatible, so you cannot
use command line options that involve running commands in the guest. Use --firstboot scripts
instead.
```

This isn't specific to building on Apple Silicon — the same mismatch exists building an `arm`
Pi image on any x86_64 CI runner too. libguestfs's own documented answer is `--firstboot`, so
that's what `provision.sh` + `repicobrew-firstboot.service` implement, just with a persistent,
`Restart=on-failure` systemd service (rather than libguestfs's own self-removing `--firstboot`
hook) so a flaky first attempt — a network hiccup mid-`pnpm install`, say — can retry on reboot
instead of silently never running again.

## Prerequisites

- Docker (or anything Docker-compatible — this was built and tested against OrbStack).
- ~10GB free disk for the base image, its decompressed/grown copy, and Docker's own layers.
- Real internet access on the **build host** to download the base image (the customize step
  itself needs no network — see above).

## Usage

```bash
docker build -t repicobrew-pi-image-builder pi-image

docker run --rm --privileged -v "$(pwd):/work" -w /work repicobrew-pi-image-builder \
  pi-image/build.sh --target zero-w   # or: --target pi4
```

`--privileged` is required — `virt-customize`'s appliance needs loop-device access to mount the
image's partitions (and `/dev/kvm` if present, for speed).

Output lands at `pi-image/work/repicobrew-<target>-<date>.img`. Compress it before distributing
(`xz -T0 -k pi-image/work/repicobrew-zero-w-....img`) and flash with Raspberry Pi Imager or:

```bash
sudo dd if=pi-image/work/repicobrew-zero-w-....img of=/dev/sdX bs=4M status=progress conv=fsync
```

### First boot

`provision.sh` installs and starts hostapd, so the Pi's `wlan0` becomes the `PICOBREW` access
point as part of that first-boot run — it won't be available to join your home WiFi. **Connect
Ethernet before first power-on** so `apt-get`/`pnpm install` have internet (this mirrors
`DEPLOY_PI.md`'s existing "Ethernet ... for initial setup" prerequisite). Watch progress with:

```bash
ssh pi@<pi-ip-on-ethernet>   # default Raspberry Pi OS password: raspberry
tail -f /var/log/repicobrew-firstboot.log
```

Once it finishes (15-45+ minutes on a Pi Zero W, mostly native addon compilation), connect to the
`PICOBREW` WiFi network and open `http://picobrew.com/` or `http://192.168.72.1/`.

## Why Bullseye, not the current Raspberry Pi OS release

`scripts/setup-pi-ap.sh` writes `dhcpcd.conf.d` config and sets `nohook wpa_supplicant` —
that's the pre-Bookworm network stack. Starting with **Bookworm** (Oct 2023), Raspberry Pi OS
defaults to **NetworkManager**, which doesn't read those files and actively fights hostapd for
`wlan0`. Rather than build against an OS release the existing, already-used AP script can't
actually configure, this pins to the last Bullseye release (2023-05-03) — still receiving security
updates, and `provision.sh` runs `apt-get dist-upgrade` on first boot to pull those in.

**Porting to NetworkManager** (so a future build can track current Raspberry Pi OS) would mean
rewriting `setup-pi-ap.sh`'s AP setup as an `nmcli` connection profile instead of
hostapd+dhcpcd.conf.d — a real, self-contained follow-up task, not attempted here since it touches
a script this build otherwise reuses unmodified.

## Known risks / what to check on a real test build

- **`provision.sh` has not been run on real hardware.** The offline half (download → resize →
  stage → `virt-customize`) has been run end-to-end successfully against the real Bullseye armhf
  image. The first-boot half — package installs, `setup-pi-ap.sh`, `pnpm install && pnpm build`,
  starting everything — has only been reviewed, not executed. Budget time for at least one failed
  first boot while debugging (that's what `/var/log/repicobrew-firstboot.log` is for).
- **No KVM on Docker Desktop/OrbStack (Apple Silicon)**: confirmed via `libguestfs-test-tool` —
  the appliance fails to boot at all without the `force_tcg` fix already baked into the
  `Dockerfile` (see its comments). Builds run in pure software emulation there, which is slower
  but works; a Linux host with real `/dev/kvm` can opt back into acceleration by overriding
  `-e LIBGUESTFS_BACKEND_SETTINGS=` (empty) on `docker run`.
- **Native addon prebuilds for `armv6l`** (Pi Zero W): `better-sqlite3` and `@stoprocent/noble`
  may not publish a prebuilt binary for that exact architecture, forcing a from-source compile on
  first boot — this is why `build-essential`/`python3` are installed and why first boot is budgeted
  at up to 45 minutes on that hardware. If it fails outright rather than just being slow, that's
  the next thing to debug.
- **`prisma migrate deploy`** replays every migration in `prisma/migrations/` in order against a
  fresh database — this repo's history includes at least one migration that was applied directly
  via `sqlite3` + `prisma migrate resolve` rather than through `prisma migrate dev` (see git log
  around the `add_device_last_seen_and_mac` migration) — worth double-checking that migration
  folder's `migration.sql` is complete and would actually apply cleanly from empty, since it was
  never exercised through the normal `migrate dev` path.

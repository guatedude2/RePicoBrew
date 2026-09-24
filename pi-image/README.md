# Building a RePicoBrew Raspberry Pi image

Produces a ready-to-flash `.img` that boots into a working `PICOBREW` WiFi access point and a
fully-built, fully-migrated RePicoBrew server, with **no internet and no provisioning wait on the Pi
at first boot.** This matters beyond convenience: this project is meant to be flashed by strangers
(open source). Burn the image, boot the Pi, join the `PICOBREW` network.

It targets **Raspberry Pi 3/4/5 and CM4** (64-bit): current Raspberry Pi OS Lite (**Trixie**, Debian 13,
pinned to a specific release in `build.sh`), which uses NetworkManager. The same image runs on all of
them. (The 32-bit Pi Zero W/Zero/1 is no longer supported: see "Why Trixie" below.)

> **Recommended: give the Pi a second connection for internet.** The `PICOBREW` access point uses the
> Pi's built-in Wi-Fi radio, which then can't also join your home network. Plug in **Ethernet** or add a
> **USB Wi-Fi adapter** (it becomes the client radio you configure in Settings → Wi-Fi). Without one the
> brewing itself works, but everything that needs the internet doesn't: the AI Brewmaster and its web
> search, software updates, and the "internet" indicator in Settings. A USB adapter can be flaky on some
> chipsets; the `wlan1-watchdog` service recovers it automatically, but Ethernet is the most reliable.

**Status:** builds end to end. The finished image was checked by mounting it and running the app and SearXNG
from inside it (Node 20.18.1, all migrations applied, the app answers, SearXNG returns JSON results). It has
**not yet been booted on real Pi hardware**.

## How it works: everything is baked in at build time, not first boot

`build.sh` runs inside a small Linux container (see `Dockerfile`) on **this build machine, with
this machine's real internet access** — not on the Pi, and not in an emulated boot. It:

1. Downloads Raspberry Pi OS **Lite, Trixie, arm64** (the release pinned in `build.sh`, checksum-verified) and
   grows the image (+4GiB by default) to leave room for `node_modules` and SearXNG.
2. Loop-mounts the image's partitions directly (`losetup` + `kpartx` — the latter because a
   container has no running `udevd` to create `/dev/loop0pN` partition device nodes on its own).
3. `chroot`s into the mounted root partition and runs `chroot-provision.sh` inside it: under
   **`qemu-aarch64-static`** (CPU emulation) when the build host isn't arm64, or **natively, with no
   emulation**, when it is (e.g. Docker on an Apple Silicon Mac, or GitHub's arm64 runners) — much faster. It
   installs nginx and the build/Bluetooth headers, Node.js, pnpm via corepack, the `pi` login, the network
   wrapper scripts and sudo rules, the systemd services, the app's dependencies, and **SearXNG** (the AI
   Brewmaster's private web search). It mirrors what `scripts/deploy-to-pi.sh` does to a stock Pi, so an
   image and a deployed Pi end up the same.
4. Runs `prisma generate` and `prisma migrate deploy` **on the build host itself**, directly
   against the mounted image — not in the chroot. See "Why Prisma runs on the host" below.
5. Builds the production bundle (`pnpm build`) on the build host too, copies it into the image, then
   `chroot`s back in a second time (`chroot-finish.sh`) to clean the apt cache. No seed data is loaded: the
   image ships an empty, migrated database so there is no shared default admin login.
6. Cleans up build-only artifacts (`qemu-*-static`, `resolv.conf`) and unmounts everything.

There is no first-boot provisioning step left at all — `chroot-provision.sh`/`chroot-finish.sh`
never run on the Pi, only during this build.

**Why not `virt-customize --run-command`?** An earlier version of this pipeline tried that; it
refuses outright whenever the host and guest CPU architectures don't match:

```
virt-customize: error: host cpu (aarch64) and guest arch (arm) are not compatible, so you cannot
use command line options that involve running commands in the guest. Use --firstboot scripts
instead.
```

That's unavoidable for a Pi image built on any other architecture (x86_64 or Apple Silicon), and
libguestfs's own documented answer (`--firstboot`) just moves all the work to the Pi's first real
boot — the opposite of the zero-touch goal here. A real `chroot` + `qemu-*-static` has no such
restriction, since it's genuinely emulating the target CPU rather than trying to cross-run guest
code on the host's own architecture.

## Why Prisma's `generate`/`migrate deploy` run on the build host, not in the chroot

The schema's `generator client { engineType = "client" }` setting (see `prisma/schema.prisma`) means the
generated client is pure JS+WASM, used only through the `@prisma/adapter-better-sqlite3` driver adapter at
runtime, so its output doesn't depend on the architecture that produced it. `prisma generate` and
`prisma migrate deploy` therefore run on the build host's own architecture, writing directly into the mounted
image at `$ROOT_MNT/home/pi/RePicoBrew`, instead of inside the chroot. On an arm64 host that is no different
from the chroot; on an amd64 host it avoids running Prisma's schema engine under CPU emulation. The
`postinstall` script that would run `prisma generate` is removed from the image's own `package.json` for the
one in-chroot install (see `chroot-provision.sh`), since it would be redundant.

The same reasoning applies to the production bundle: `pnpm build` runs on the host and the resulting
`build/` (pure JS/CSS/HTML) is copied into the image.

## Node version and `vite.config.mts`

`@react-router/dev` and `@react-router/serve` both hard-require Node `>=20.0.0`. The image installs Node
`20.18.1` (the official arm64 build, the same version `scripts/deploy-to-pi.sh` installs on a live Pi); it is set
in `build.sh` as `NODE_VERSION`.

Separately, `vite.config.ts` is named `vite.config.mts` — Vite bundles a plain `.ts` config as CommonJS by
default (this project has no `"type": "module"`), and `require()`-ing the ESM-only `@tailwindcss/vite` package
under CJS fails with `ERR_REQUIRE_ESM` on older Node versions. The `.mts` extension tells Vite to load the config
as genuine ESM instead, sidestepping the issue regardless of Node version.

## Getting a prebuilt image (GitHub Actions)

The **Build Raspberry Pi image** workflow (`.github/workflows/build-pi-image.yml`) builds the `pi4` image
and publishes it, so you don't need Docker or a build machine:

- **On demand:** GitHub → **Actions → Build Raspberry Pi image → Run workflow**. When it finishes, download
  `repicobrew-pi4-<commit>` from the run's **Artifacts** section (kept 14 days). The download is a ZIP
  containing `…img.xz` and a `.sha256` file.
- **On a release:** pushing a version tag (`git tag v1.2.0 && git push origin v1.2.0`) runs it and also attaches
  the image to that tag's GitHub release, where it doesn't expire.

Downloading needs a GitHub login with access to this repository. Then flash the `.img.xz` with
[Raspberry Pi Imager](https://www.raspberrypi.com/software/) as described under "Usage" below. A compressed
image is about 1.3GB. The workflow builds natively on GitHub's arm64 runner (`ubuntu-24.04-arm`); the
"runner" input can be set to `ubuntu-latest` if arm64 runners aren't available, at the cost of a much slower
emulated build.

## Prerequisites

- Docker (or anything Docker-compatible — this was built and tested against OrbStack).
- `--privileged` on `docker run` — loop-device/`kpartx` access needs it.
- ~15GB free disk: the finished `pi4` image is about 7.4GB (the base grown by 4GB, plus the app and
  SearXNG), plus the compressed base download and Docker's own layers.
- Real internet access on the **build host** (not the Pi) for package installs, Node.js, and
  `pnpm install`.

## Usage

```bash
docker build -t repicobrew-pi-image-builder pi-image

docker run --rm --privileged -v "$(pwd):/work" -w /work repicobrew-pi-image-builder \
  pi-image/build.sh
```

Add `--skip-download` to reuse a base image already in `pi-image/cache/`. Other options: `--hostname`,
`--output`, `--grow-by` (`--target pi4` is accepted but is the only, default, target).

On an arm64 host the build runs natively and takes on the order of ten minutes (mostly downloads and
`pnpm install`); under CPU emulation on an amd64 host expect much longer. Output lands at
`pi-image/work/repicobrew-pi4-<date>.img`. Compress it before distributing
(`xz -T0 -k pi-image/work/repicobrew-pi4-....img`).

If a build fails partway it can leave loop devices attached inside Docker's VM, which makes the next
mount fail with "permission denied". Clear them with:

```bash
docker run --rm --privileged repicobrew-pi-image-builder bash -c \
  'for l in $(losetup -a | cut -d: -f1); do kpartx -d $l; done; dmsetup remove_all; losetup -D'
```

**Flash with [Raspberry Pi Imager](https://www.raspberrypi.com/software/)** — download it for macOS, Windows
or Linux from https://www.raspberrypi.com/software/ (recommended). Steps:

1. **Choose Device** (Raspberry Pi 4/5/…), then **Choose OS → Use custom** and pick the `.img.xz` (or `.img`) file.
   Imager decompresses `.xz` itself, so there's no need to unpack it first.
2. **Choose Storage** (your SD card / USB drive) and click **Next**.
3. When Imager offers **OS customisation** (hostname, user, Wi-Fi, SSH), choose **No / skip**. The image is
   already set up (see "First boot"), and it doesn't use cloud-init, so those settings wouldn't be applied
   anyway.
4. Leave **Verify** on. Imager reads the card back after writing, which `dd` never does.

On real hardware, an image written with plain `dd` (to a card that had also been hard-power-cycled a few
times) ran unusably slowly — SSH logins taking minutes, an interactive shell stalling for minutes on trivial
commands, `vmstat` showing ~99% I/O wait — while the identical image re-flashed with Imager on the same card
was fast. The cause wasn't pinned down (an unverified bad write and accumulated filesystem damage from the
power cuts are both plausible), so prefer Imager.

If you do use `dd`, at least check the result, and use the raw device on macOS (`/dev/rdiskX`, much
faster than the buffered `/dev/diskX`):

```bash
sudo dd if=pi-image/work/repicobrew-pi4-....img of=/dev/rdiskX bs=4m conv=sync
```

### First boot

**`pi4`:** power it on. nginx, the app and SearXNG are already installed, migrated and enabled. On the
very first boot `repicobrew-first-boot.service` (script: `scripts/network/first-boot-ap.sh`) sets the
Wi-Fi regulatory country (default **US**; Raspberry Pi OS keeps Wi-Fi blocked until one is set),
unblocks Wi-Fi and creates the `PICOBREW` access point (password `picobrew123`) through
NetworkManager. It can't be created while building the image (no NetworkManager or radio in a
chroot), so the network appears a little after boot rather than instantly. Then connect to it and open
`http://picobrew.com/` or `http://192.168.72.1/`. Change the AP name/password, hostname and Wi-Fi in
the Setup wizard/Settings. To use another country, set `WIFI_COUNTRY` in that unit or run
`sudo raspi-config` (Localisation Options).

**Internet: use Ethernet or a USB Wi-Fi adapter (recommended).** The access point occupies the Pi's
built-in Wi-Fi radio (NetworkManager hotspot mode), so the Pi has no way to reach the internet on its own
unless you give it a second connection:

- **Ethernet** — the simplest and most reliable; it works with no configuration.
- **A USB Wi-Fi adapter** — it is picked up automatically as the client radio; join your home network
  from the Setup wizard or Settings → Wi-Fi.

With neither, brewing and everything on the local network still works, but the AI features, web search
and software updates won't. Login is `pi` / `raspberry` over SSH (enabled).

## Why Trixie (and no Pi Zero W)

The scripts that manage networking (`apply-ap.sh`, `apply-wifi.sh`, `wifi-client-radio.sh`,
`wlan1-watchdog.sh`, `setup-nm-ap.sh`) all call `nmcli`, so the image needs a NetworkManager-based Raspberry
Pi OS (Bookworm or newer, Trixie now) and creates the access point with `setup-nm-ap.sh`, exactly as a live
deployed Pi does. An older image target based on Raspberry Pi OS Bullseye (hostapd + dhcpcd, for the 32-bit
ARMv6 Pi Zero W) has been removed: Bullseye reached end of life in 2026 (`deb.debian.org` no longer serves
its security packages, so even `git` fails to install), and current Raspberry Pi OS has no 32-bit ARMv6 build.
The manual install guide (`DEPLOY_PI.md`) still describes the older hostapd-based setup for hand-installs.

## What `chroot-provision.sh` does

- Installs nginx, git, build tools and the Bluetooth headers. It does not run `dist-upgrade` (the base is
  recent, and upgrading kernel packages in a chroot triggers initramfs rebuilds for no benefit).
- The base image's `pi` user has no password and a `nologin` shell, plus a first-boot user wizard
  (`userconfig.service`) and cloud-init. The script gives `pi` a `bash` shell and the `raspberry` password,
  masks the wizard, disables cloud-init and enables SSH, so the image works headless.
- Python 3.13 is already on the image, so SearXNG installs with the system Python (current SearXNG needs
  Python 3.10+). `scripts/setup-searxng.sh` takes `SKIP_SERVICE_START=1` for this chroot case: it enables the
  service by symlink and it starts on first boot. The app finds it at `http://127.0.0.1:8888` by default
  (`SEARXNG_URL` overrides it).
- `resolv.conf` is a symlink into `/run` on NetworkManager releases (dangling in a chroot), so `build.sh` swaps
  in the host's file for the build and restores the symlink afterwards. (The Trixie base image ships none;
  NetworkManager creates it at boot.)
- The access point can't be created in a chroot (no NetworkManager or radio), so `repicobrew-first-boot.service`
  does it on first boot; see "First boot".

## Known risks / what's been verified

- **Verified**: the whole pipeline builds; the image mounts; the `pi` login, sudo rules,
  network scripts, nginx config and the app/SearXNG systemd units are in place; Node 20.18.1 runs;
  the database has the full schema; the app and SearXNG both start and answer from inside the image
  (checked in an overlay so the image itself wasn't modified).
- **Not verified**: a real boot on Pi hardware, and any internet path (Ethernet or a USB Wi-Fi
  adapter, see above). In particular the first-boot AP creation
  (`first-boot-ap.sh` → `setup-nm-ap.sh`) has only been exercised on a live Pi, never from a fresh
  image, and the Wi-Fi country/rfkill handling is untested on first boot. Check
  `journalctl -u repicobrew-first-boot -u NetworkManager -u repicobrew` over SSH if `PICOBREW`
  doesn't appear.
- **Default login** is `pi` / `raspberry`. Raspberry Pi OS ships no working default password, so the
  provisioning scripts set it; change it on any Pi that isn't on a private network.
- **No KVM on Docker Desktop/OrbStack (Apple Silicon)**: the image resize step (`virt-resize`) runs
  under TCG (`LIBGUESTFS_BACKEND_SETTINGS=force_tcg`, already set in the `Dockerfile`). A Linux host
  with real `/dev/kvm` can override this for speed.

# Building a RePicoBrew Raspberry Pi image

Produces a ready-to-flash `.img` that boots into a working `PICOBREW` WiFi access point and a
fully-built, fully-migrated RePicoBrew server, with **no internet and no provisioning wait on the Pi
at first boot.** This matters beyond convenience: this project is meant to be flashed by strangers
(open source). Burn the image, boot the Pi, join the `PICOBREW` network.

There are two targets:

| Target                  | Hardware                             | Base OS                                                 | Network stack    | Provisioning script      |
| ----------------------- | ------------------------------------ | ------------------------------------------------------- | ---------------- | ------------------------ |
| **`pi4`** (recommended) | Pi 3/4/5, CM4 (64-bit)               | Raspberry Pi OS Lite **Trixie** (Debian 13), 2026-09-15 | NetworkManager   | `chroot-provision-nm.sh` |
| `zero-w` (legacy)       | Pi Zero W / Zero / 1 (32-bit, ARMv6) | Raspberry Pi OS Lite **Bullseye**, 2023-05-03           | hostapd + dhcpcd | `chroot-provision.sh`    |

**Status:**

- **`pi4`**: builds end to end. The finished image was checked by mounting it and running the app and
  SearXNG from inside it (Node 20.18.1, all migrations applied, the app answers, SearXNG returns JSON
  results). It has **not yet been booted on real Pi hardware**.
- **`zero-w`**: last built in Sep 2026 before the Trixie port. Bullseye is past end of life and its
  security packages are gone from the main Debian mirror (`apt-get install` fails on them), so this
  target likely no longer builds as-is. See "Why two targets" below.

## How it works: everything is baked in at build time, not first boot

`build.sh` runs inside a small Linux container (see `Dockerfile`) on **this build machine, with
this machine's real internet access** — not on the Pi, and not in an emulated boot. It:

1. Downloads Raspberry Pi OS **Lite, Bullseye** (2023-05-03) for the target architecture and grows
   the image (+4GiB by default) to leave room for `node_modules`.
2. Loop-mounts the image's partitions directly (`losetup` + `kpartx` — the latter because a
   container has no running `udevd` to create `/dev/loop0pN` partition device nodes on its own).
3. `chroot`s into the mounted root partition and runs the target's provisioning script inside it
   (`chroot-provision-nm.sh` for `pi4`, `chroot-provision.sh` for `zero-w`). Under
   **`qemu-arm-static`/`qemu-aarch64-static`** (real CPU emulation) when the build host is a different
   architecture; **natively, with no emulation**, when the host is already arm64 (e.g. Docker on an
   Apple Silicon Mac building `pi4`) — much faster. For `pi4` it installs nginx and the build/Bluetooth
   headers, an architecture-correct Node.js, pnpm via corepack, the `pi` login, the network wrapper
   scripts and sudo rules, the systemd services, the app's dependencies, and **SearXNG** (the AI
   Brewmaster's private web search). It mirrors what `scripts/deploy-to-pi.sh` does to a stock Pi, so
   an image and a deployed Pi end up the same. `zero-w` additionally sets up hostapd/dnsmasq and
   compiles the native addons from source under ARMv6 emulation.
4. Runs `prisma generate` and `prisma migrate deploy` **on the build host itself**, directly
   against the mounted image — not in the chroot. See "Why Prisma runs on the host" below.
5. `chroot`s back in a second time (`chroot-finish.sh`) to run `prisma db seed` and `pnpm build`,
   which do need the emulated ARM environment.
6. Copies the finished, fully-built app into the image, cleans up build-only artifacts
   (`qemu-*-static`, apt cache, `resolv.conf`), and unmounts everything.

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

Prisma publishes native engine binaries only for `amd64`/`arm64` Linux — **32-bit ARM
(`linux-arm`, the Pi Zero W's actual architecture) has no published binary at all**, confirmed by
a hard 404 fetching both the query-engine and the schema-engine. The schema's
`generator client { engineType = "client" }` setting (see `prisma/schema.prisma`) avoids the
_query_-engine download entirely — the generated client is pure JS+WASM, used only through the
`@prisma/adapter-better-sqlite3` driver adapter at runtime — but the `prisma` CLI itself still
resolves a schema-engine binary on startup for `generate`/`migrate`/`db seed`, regardless of that
setting.

Since the generated client output is architecture-independent (no native binary in it at all),
`generate` and `migrate deploy` run on the build host's own architecture instead (amd64/arm64,
both fully supported by Prisma), writing directly into the mounted image at
`$ROOT_MNT/home/pi/RePicoBrew`. `db seed` can't follow them there — it loads the ARM-_compiled_
`better-sqlite3` native binding through the driver adapter, so it has to run back inside the
chroot's emulation; it also runs as `prisma exec tsx prisma/seed.ts` directly rather than
`prisma db seed`, since the `prisma` CLI wrapper hits the same missing-schema-engine 404 for _any_
subcommand, seed included.

## Why Node is pinned to `20.9.0` on the `zero-w` target

_(Applies to `zero-w` only. The `pi4` target runs on Trixie's newer glibc and uses Node `20.18.1`, the same version `scripts/deploy-to-pi.sh` installs.)_

`@react-router/dev` and `@react-router/serve` both hard-require Node `>=20.0.0` — confirmed by
hitting an actual runtime failure on Node 18. But the _latest_ Node 20.x
(`unofficial-builds.nodejs.org`'s armv6l build) is compiled against a newer glibc/libstdc++ than
Bullseye ships, and fails outright at startup:

```
node: /lib/arm-linux-gnueabihf/libstdc++.so.6: version `GLIBCXX_3.4.30' not found (required by node)
```

`20.9.0` (an early 20.x point release) only requires up to `GLIBCXX_3.4.21` — confirmed via
`objdump -T` — comfortably within what Bullseye's toolchain provides, while still satisfying the
`>=20.0.0` floor. If bumping Node ever becomes necessary, re-check this with:

```bash
docker run --rm -v /path/to/node/bin:/host repicobrew-pi-image-builder \
  bash -c "objdump -T /host/node | grep -o 'GLIBCXX_[0-9.]*' | sort -Vu | tail -3"
```

Separately, `vite.config.ts` is named `vite.config.mts` — Vite bundles a plain `.ts` config as
CommonJS by default (this project has no `"type": "module"`), and `require()`-ing the ESM-only
`@tailwindcss/vite` package under CJS fails with `ERR_REQUIRE_ESM` on any Node before `require(esm)`
support landed (Node 22.12+/20.19+, both newer than the `20.9.0` we need for glibc reasons). The
`.mts` extension tells Vite to load the config as genuine ESM instead, sidestepping the issue
regardless of Node version.

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
  pi-image/build.sh --target pi4   # or: --target zero-w (legacy)
```

Add `--skip-download` to reuse a base image already in `pi-image/cache/`. Options: `--hostname`,
`--output`, `--grow-by`.

`pi4` on an arm64 host runs natively and takes on the order of ten minutes (mostly downloads and
`pnpm install`); `zero-w`, or any build under emulation, takes 20-45+ minutes. Output lands at
`pi-image/work/repicobrew-<target>-<date>.img`. Compress it before distributing
(`xz -T0 -k pi-image/work/repicobrew-pi4-....img`).

If a build fails partway it can leave loop devices attached inside Docker's VM, which makes the next
mount fail with "permission denied". Clear them with:

```bash
docker run --rm --privileged repicobrew-pi-image-builder bash -c \
  'for l in $(losetup -a | cut -d: -f1); do kpartx -d $l; done; dmsetup remove_all; losetup -D'
```

**Flash with Raspberry Pi Imager** (Choose OS → Use custom, leave "Verify" on). Imager reads the
card back after writing, which `dd` never does. On real hardware, an image written with plain `dd`
(to a card that had also been hard-power-cycled a few times) ran unusably slowly — SSH logins taking
minutes, an interactive shell stalling for minutes on trivial commands, `vmstat` showing ~99% I/O
wait — while the identical image re-flashed with Imager on the same card was fast. The cause wasn't
pinned down (an unverified bad write and accumulated filesystem damage from the power cuts are both
plausible), so prefer Imager.

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

The access point occupies the Pi's built-in Wi-Fi radio (NetworkManager hotspot mode), so for
**internet** (AI features, web search, updates) the Pi needs Ethernet or a second, USB Wi-Fi radio,
which Settings uses as the client radio. Login is `pi` / `raspberry` over SSH (enabled).

**`zero-w`:** hostapd, dnsmasq, nginx and the app are enabled in the image; the AP comes up on the
virtual `uap0` interface within normal boot time.

## Why two targets

`scripts/setup-pi-ap.sh` (used by `zero-w`) writes `dhcpcd.conf.d` config and sets `nohook
wpa_supplicant` — the pre-Bookworm network stack. Since **Bookworm** (Oct 2023) Raspberry Pi OS uses
**NetworkManager**, which ignores those files and fights hostapd for `wlan0`. The scripts added since
(`apply-ap.sh`, `apply-wifi.sh`, `wifi-client-radio.sh`, `wlan1-watchdog.sh`, `setup-nm-ap.sh`) all
call `nmcli`, so a Bullseye image can't run them. The `pi4` target therefore builds on current
Raspberry Pi OS (Trixie) and creates the AP with `setup-nm-ap.sh`, exactly as a live deployed Pi does.

Bullseye reached end of life in 2026: `deb.debian.org` no longer serves its security packages (even
`git` fails to install) and `archive.debian.org` doesn't have them yet. The `zero-w` target still
points at it and will likely fail at its `apt-get` steps until it is pointed at archive mirrors or
ported too. Trixie also has no 32-bit ARMv6 build, so a Zero W port would need its own decision.

## What `chroot-provision-nm.sh` does differently from the Bullseye script

- No `dist-upgrade` (the base is recent; upgrading kernel packages in a chroot triggers initramfs
  rebuilds for no benefit), and no hostapd/dnsmasq/dhcpcd/`uap0` machinery.
- The base image's `pi` user has no password and a `nologin` shell, plus a first-boot user wizard
  (`userconfig.service`) and cloud-init. The script gives `pi` a `bash` shell and the `raspberry`
  password, masks the wizard, disables cloud-init and enables SSH, so the image works headless.
- Python 3.13 is already on the image, so SearXNG installs unpinned with the system Python (older
  Bullseye has 3.9, which current SearXNG doesn't support). `scripts/setup-searxng.sh` takes
  `SKIP_SERVICE_START=1` for this chroot case: it enables the service by symlink and starts it on
  first boot. The app finds it at `http://127.0.0.1:8888` by default (`SEARXNG_URL` overrides it).
- `resolv.conf` is a symlink into `/run` on NetworkManager releases (dangling in a chroot), so
  `build.sh` swaps in the host's file for the build and restores the symlink afterwards. (The
  Trixie base image ships none; NetworkManager creates it at boot.)

## Known risks / what's been verified

- **`pi4`, verified**: the whole pipeline builds; the image mounts; the `pi` login, sudo rules,
  network scripts, nginx config and the app/SearXNG systemd units are in place; Node 20.18.1 runs;
  the database has the full schema; the app and SearXNG both start and answer from inside the image
  (checked in an overlay so the image itself wasn't modified).
- **`pi4`, not verified**: a real boot on Pi hardware. In particular the first-boot AP creation
  (`first-boot-ap.sh` → `setup-nm-ap.sh`) has only been exercised on a live Pi, never from a fresh
  image, and the Wi-Fi country/rfkill handling is untested on first boot. Check
  `journalctl -u repicobrew-first-boot -u NetworkManager -u repicobrew` over SSH if `PICOBREW`
  doesn't appear.
- **`zero-w`**: see the status note above; the Bullseye end-of-life makes it likely broken.
- **Default login** is `pi` / `raspberry`. Raspberry Pi OS ships no working default password, so the
  provisioning scripts set it; change it on any Pi that isn't on a private network.
- **No KVM on Docker Desktop/OrbStack (Apple Silicon)**: the image resize step (`virt-resize`) runs
  under TCG (`LIBGUESTFS_BACKEND_SETTINGS=force_tcg`, already set in the `Dockerfile`). A Linux host
  with real `/dev/kvm` can override this for speed.

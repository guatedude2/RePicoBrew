# Building a RePicoBrew Raspberry Pi image

Produces a ready-to-flash `.img` that boots straight into a working `PICOBREW` WiFi access point
and a fully-built, fully-migrated-and-seeded RePicoBrew server — **no internet and no first-boot
setup needed on the Pi at all.** This matters beyond convenience: this project is meant to be
flashed by strangers (open source), who won't have a way to hand it their home WiFi credentials or
plug in Ethernet. Burn the image, boot the Pi, join the `PICOBREW` network — that's it.

**Status: built and verified end-to-end in the build pipeline (package installs, Node/pnpm,
Prisma generate/migrate/seed, `pnpm build` all complete successfully for the `zero-w` target).**
See "Known risks" below for what that does and doesn't cover.

## How it works: everything is baked in at build time, not first boot

`build.sh` runs inside a small Linux container (see `Dockerfile`) on **this build machine, with
this machine's real internet access** — not on the Pi, and not in an emulated boot. It:

1. Downloads Raspberry Pi OS **Lite, Bullseye** (2023-05-03) for the target architecture and grows
   the image (+4GiB by default) to leave room for `node_modules`.
2. Loop-mounts the image's partitions directly (`losetup` + `kpartx` — the latter because a
   container has no running `udevd` to create `/dev/loop0pN` partition device nodes on its own).
3. `chroot`s into the mounted root partition under **`qemu-arm-static`/`qemu-aarch64-static`**
   (real CPU emulation, not just a static binary copy) and runs `chroot-provision.sh` inside it:
   installs system packages (hostapd, dnsmasq, nginx, Bluetooth, build tools), installs an
   architecture-correct Node.js, enables pnpm via corepack, configures the WiFi AP + nginx reverse
   proxy, installs the systemd services, and runs `pnpm install` — including compiling
   `better-sqlite3` and `@stoprocent/noble`'s native addons from source, for real, under emulation.
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

## Why Node is pinned to `20.9.0`, not latest

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
- ~10GB free disk for the base image, its grown copy, and Docker's own layers.
- Real internet access on the **build host** (not the Pi) for package installs, Node.js, and
  `pnpm install`.

## Usage

```bash
docker build -t repicobrew-pi-image-builder pi-image

docker run --rm --privileged -v "$(pwd):/work" -w /work repicobrew-pi-image-builder \
  pi-image/build.sh --target zero-w   # or: --target pi4
```

Expect 20-45+ minutes, mostly native addon compilation for `better-sqlite3`/`@stoprocent/noble`
under ARM emulation. Output lands at `pi-image/work/repicobrew-<target>-<date>.img`. Compress it
before distributing (`xz -T0 -k pi-image/work/repicobrew-zero-w-....img`).

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
sudo dd if=pi-image/work/repicobrew-zero-w-....img of=/dev/rdiskX bs=4m conv=sync
```

### First boot

Power it on. hostapd, nginx, and the fully-built app are already installed, migrated, seeded, and
enabled — the `PICOBREW` WiFi network should appear within normal boot time, no Ethernet, no
waiting, no SSH required. Connect to it and open `http://picobrew.com/` or `http://192.168.72.1/`.

## Why Bullseye, not the current Raspberry Pi OS release

`scripts/setup-pi-ap.sh` writes `dhcpcd.conf.d` config and sets `nohook wpa_supplicant` — the
pre-Bookworm network stack. Starting with **Bookworm** (Oct 2023), Raspberry Pi OS defaults to
**NetworkManager**, which doesn't read those files and actively fights hostapd for `wlan0`. Rather
than build against an OS release the existing AP script can't actually configure, this pins to the
last Bullseye release (2023-05-03) — still receiving security updates, and `chroot-provision.sh`
runs `apt-get dist-upgrade` at build time to pull those in.

**Porting to NetworkManager** (so a future build can track current Raspberry Pi OS) would mean
rewriting `setup-pi-ap.sh`'s AP setup as an `nmcli` connection profile instead of
hostapd+dhcpcd.conf.d — a real, self-contained follow-up task, not attempted here since it touches
a script this build otherwise reuses unmodified.

## Known risks / what's been verified

- **Verified**: the full build pipeline — package installs, Node 20.9.0 + pnpm, `pnpm install`
  (including native addon compilation for `better-sqlite3`/`@stoprocent/noble` under real ARM
  emulation), `prisma generate`/`migrate deploy`/`db seed`, and `pnpm build` — completes
  successfully end-to-end for the `zero-w` target.
- **Not yet independently verified here**: a real first boot on Pi Zero W hardware confirming the
  `PICOBREW` AP actually comes up and the app is reachable — budget time for at least one
  surprise, and check `journalctl -u hostapd -u dnsmasq -u repicobrew` over SSH if the AP doesn't
  appear. Login is `pi` / `raspberry` — note this is **not** actually Raspberry Pi OS's own
  default (that was removed entirely in April 2022:
  https://www.raspberrypi.com/news/raspberry-pi-bullseye-update-april-2022/); without setting it
  explicitly in `chroot-provision.sh`, there would be no way to log in at all, not even over a
  directly-wired UART serial console (confirmed the hard way).
- **No KVM on Docker Desktop/OrbStack (Apple Silicon)**: confirmed via `libguestfs-test-tool` that
  earlier `virt-customize`-based steps (image download/resize) need `LIBGUESTFS_BACKEND_SETTINGS=
force_tcg`, already baked into the `Dockerfile`. A Linux host with real `/dev/kvm` can override
  this back to acceleration for that step.
- **`pi4` target is unverified** — all of the above has only actually been run against `zero-w`
  this round; the `pi4`/arm64 code path shares the same script but hasn't been exercised.

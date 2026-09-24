# Builder for pi-image/build.sh — NOT the RePicoBrew app image. This runs the image-customization
# toolchain (libguestfs, qemu-user-static) on the host machine (e.g. a Mac dev box) so nobody needs
# those tools installed natively. Build once, then run build.sh inside it against a mounted repo.
#
#   docker build -t repicobrew-pi-image-builder pi-image
#   docker run --rm --privileged -v "$(pwd):/work" -w /work repicobrew-pi-image-builder \
#     pi-image/build.sh --target pi4
#
# --privileged is required: virt-customize's supermin appliance needs /dev/kvm (if present) and
# loop-device access to mount the disk image's partitions.
FROM debian:bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

# linux-image-<arch>: the kernel libguestfs's own appliance boots to inspect/edit the Pi image —
# unrelated to the Pi's arm kernel inside that image. Named per the *builder container's* own
# architecture (amd64 on typical CI/Intel, arm64 on Apple Silicon), not the Pi image's target.
# ipxe-qemu: virt-customize --network (needed for apt-get inside the guest) attaches a virtio-net
# device to the appliance, which fails to launch at all with "failed to find romfile
# efi-virtio.rom" without this — Debian's qemu-system-common doesn't ship it separately
# (confirmed by hitting exactly this error while building this).
# Node.js is installed separately below (from the official tarball, not apt): the host-side app build and the
# `prisma generate`/`migrate deploy` in build.sh run on this container's own architecture, and need Node >= 20.
# build-essential/python3: needed for the host-side `pnpm install` in build.sh to succeed at all —
# native deps like @stoprocent/noble spawn node-gyp during install regardless of whether they'll
# ever actually run on this host (confirmed: install hard-fails with ENOENT without these, even
# though the resulting binary is never invoked — `pnpm build` never executes application code).
RUN apt-get update && apt-get install -y --no-install-recommends \
      libguestfs-tools \
      "linux-image-$(dpkg --print-architecture)" \
      qemu-user-static \
      binfmt-support \
      ipxe-qemu \
      parted \
      kpartx \
      xz-utils \
      wget \
      rsync \
      ca-certificates \
      build-essential \
      python3 \
    && rm -rf /var/lib/apt/lists/*

# Node.js 20 (official build for this container's architecture) for the host-side build. Debian bookworm's own
# `nodejs` is 18, which @react-router/dev refuses to run on, and which makes pnpm skip optional native packages
# that declare `engines: node >= 20` (e.g. @tailwindcss/oxide-linux-arm64-gnu) — the build then fails with
# "Cannot find native binding". Kept in step with NODE_VERSION in build.sh (the version installed on the Pi).
ARG NODE_VERSION=20.18.1
RUN set -eux; \
    case "$(dpkg --print-architecture)" in amd64) node_arch=x64 ;; arm64) node_arch=arm64 ;; *) echo "unsupported builder architecture" >&2; exit 1 ;; esac; \
    wget -qO- "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${node_arch}.tar.xz" | tar -xJ -C /usr/local --strip-components=1; \
    node --version

# pnpm via its official standalone installer — neither npm nor corepack come with Debian's
# `nodejs` package here (confirmed: both "not found" after installing it) — for the host-side
# `pnpm install`+`pnpm build` in build.sh (the app is built on the host's own architecture, then copied into the
# image — see build.sh).
ENV PNPM_HOME=/root/.local/share/pnpm
ENV PATH="$PNPM_HOME/bin:$PATH"
RUN curl -fsSL https://get.pnpm.io/install.sh | SHELL=/bin/bash sh -
# node-gyp-build (used by @stoprocent/noble's install script) spawns a bare `node-gyp` off PATH
# directly — the corepack-installed pnpm used inside the chroot bundles node-gyp internally and
# exposes it that way, but this standalone install doesn't, so it needs installing explicitly
# (confirmed: ENOENT spawning node-gyp otherwise, even with build-essential/python3 present).
# Pinned to v10 — latest node-gyp (v13) pulls in undici@8, which itself needs Node runtime globals
# newer than older Node releases provide, and can crash with `ReferenceError: File is not defined` just trying to
# load. v10 matches what the corepack-bundled copy inside the chroot already uses successfully.
RUN pnpm add -g node-gyp@10

# libguestfs's supermin appliance needs a kernel it can boot under QEMU to inspect/modify the
# image — the kernel installed above (unrelated to the Pi's own arm kernel, which lives inside the
# image being customized and is never executed by the appliance itself).
ENV LIBGUESTFS_BACKEND=direct
# Without /dev/kvm (true on Docker Desktop/OrbStack on Apple Silicon, and on some CI runners),
# libguestfs's aarch64 appliance picks `-machine virt,gic-version=host` assuming KVM, then falls
# back to TCG without correcting it — `gic-version=host` is invalid without KVM, and the appliance
# fails to boot at all (confirmed via `libguestfs-test-tool` while building this). Forcing pure
# TCG up front avoids that broken fallback path; on a host that genuinely has /dev/kvm, override
# with `-e LIBGUESTFS_BACKEND_SETTINGS=` (empty) for a faster, KVM-accelerated build.
ENV LIBGUESTFS_BACKEND_SETTINGS=force_tcg

WORKDIR /work

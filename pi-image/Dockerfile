# Builder for pi-image/build.sh — NOT the RePicoBrew app image. This runs the image-customization
# toolchain (libguestfs, qemu-user-static) on the host machine (e.g. a Mac dev box) so nobody needs
# those tools installed natively. Build once, then run build.sh inside it against a mounted repo.
#
#   docker build -t repicobrew-pi-image-builder pi-image
#   docker run --rm --privileged -v "$(pwd):/work" -w /work repicobrew-pi-image-builder \
#     pi-image/build.sh --target zero-w
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
# nodejs: NOT for the Pi image itself (that gets its own architecture-correct tarball — see
# build.sh) — this runs `prisma generate`/`migrate deploy` on the build host's own native
# architecture (amd64/arm64, both fully supported by Prisma) instead of under this container's ARM
# emulation, where Prisma publishes no engine binary at all for 32-bit ARM (confirmed via 404s).
# The generated client itself is pure JS+WASM (engineType="client"), so it doesn't matter which
# machine produced it — see chroot-provision.sh/chroot-finish.sh for the split.
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
      nodejs \
    && rm -rf /var/lib/apt/lists/*

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

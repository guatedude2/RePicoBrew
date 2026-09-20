#!/bin/bash
# Starts `apt-get upgrade` as a detached transient systemd unit and returns immediately, so a
# multi-minute upgrade isn't tied to a web request (or killed if the app restarts mid-upgrade).
# Progress is read back with `systemctl is-active/show repicobrew-apt-upgrade` and its journal.
# Takes no arguments on purpose: the sudoers rule for it is an exact command. Invoked from
# app/utils/system-control.server.ts.
set -euo pipefail
systemctl reset-failed repicobrew-apt-upgrade.service 2>/dev/null || true
exec systemd-run --unit=repicobrew-apt-upgrade --collect --no-block \
  --setenv=DEBIAN_FRONTEND=noninteractive \
  apt-get -y -o Dpkg::Options::=--force-confold upgrade

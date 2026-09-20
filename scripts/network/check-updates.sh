#!/bin/bash
# Refreshes the apt package lists so the app can list pending updates (`apt list --upgradable` needs
# no privilege once the lists are fresh). Takes no arguments on purpose: the sudoers rule for it is
# an exact command, and this is the only thing it ever does. Invoked from
# app/utils/system-control.server.ts.
set -euo pipefail
exec apt-get update -qq

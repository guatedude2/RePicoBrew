#!/bin/bash
# Restart the app service, reboot, or power off — scheduled 2 seconds out as a separate transient
# systemd unit, and this script returns immediately.
#
# Why not just `sudo systemctl restart ...` from the app: the app (and so the sudo/systemctl child it
# spawns) lives inside repicobrew.service's cgroup, and systemd SIGTERMs everything in that cgroup as
# soon as the stop begins — the child dies mid-command and the request fails ("Command failed") even
# though the restart itself goes ahead. `systemctl --no-block` isn't enough: the stop still starts
# before the child has finished exiting. A transient timer unit runs outside the service's cgroup, and
# the 2s delay also lets the HTTP response reach the browser before anything goes down.
#
# The only accepted arguments are the three literal words below (exact sudoers rules, one per word);
# invoked from app/utils/system-control.server.ts.
set -euo pipefail

case "${1:-}" in
  restart) action=(restart repicobrew.service) ;;
  reboot) action=(reboot) ;;
  shutdown) action=(poweroff) ;;
  *)
    echo "usage: power.sh restart|reboot|shutdown" >&2
    exit 1
    ;;
esac

exec systemd-run --quiet --on-active=2 --no-block --collect /usr/bin/systemctl "${action[@]}"

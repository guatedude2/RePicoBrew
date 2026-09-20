import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type SystemControlResult = { success: true } | { success: false; error: string };

// These two argv arrays ARE the entire sudo surface this app is allowed to use — granted to the
// `pi` user via the passwordless /etc/sudoers.d/repicobrew-control rule that
// pi-image/chroot-provision.sh (automated image builds) and DEPLOY_PI.md (manual setup) both
// install. repicobrew.service runs as the unprivileged User=pi, so the running Node
// process otherwise has no privilege to restart itself or reboot the host.
//
// execFile (not exec/spawn with shell:true) never invokes a shell, so there is no string
// interpolation or shell-metacharacter risk here — these exact fixed argument lists are always
// what runs, never anything built from user/request input. Do not change that.
// Restart/reboot/shutdown go through a fixed-content root script that schedules the action as a
// separate systemd job and returns immediately — see scripts/network/power.sh for why running
// `systemctl restart` directly from this process (which lives inside the service being restarted)
// can't work. Exact sudoers rules, one per word; nothing here is ever built from request input.
const POWER_SCRIPT = '/usr/local/sbin/repicobrew-network/power.sh';
const RESTART_SERVER_ARGS = [POWER_SCRIPT, 'restart'];
const REBOOT_ARGS = [POWER_SCRIPT, 'reboot'];

async function runSudoCommand(args: readonly string[]): Promise<SystemControlResult> {
  try {
    await execFileAsync('sudo', [...args], { timeout: 10_000 });
    return { success: true };
  } catch (error) {
    // Expected and harmless on a non-Pi dev machine (no `pi` user, no sudoers rule, no
    // repicobrew.service unit) — surface it as a normal error result rather than letting it
    // throw out of an action and crash the request.
    return { success: false, error: error instanceof Error ? error.message : 'Command failed' };
  }
}

export async function restartServer(): Promise<SystemControlResult> {
  return runSudoCommand(RESTART_SERVER_ARGS);
}

export async function rebootPi(): Promise<SystemControlResult> {
  return runSudoCommand(REBOOT_ARGS);
}

const SHUTDOWN_ARGS = [POWER_SCRIPT, 'shutdown'];
// Fixed-content, argument-less root scripts (see scripts/network/): exact sudoers commands, nothing
// here is ever built from request input.
const CHECK_UPDATES_SCRIPT = '/usr/local/sbin/repicobrew-network/check-updates.sh';
const START_UPDATES_SCRIPT = '/usr/local/sbin/repicobrew-network/start-updates.sh';
const UPGRADE_UNIT = 'repicobrew-apt-upgrade.service';

export async function shutdownPi(): Promise<SystemControlResult> {
  return runSudoCommand(SHUTDOWN_ARGS);
}

export type PendingUpdate = { name: string; from: string; to: string };

export type UpdateCheckResult = { success: true; updates: PendingUpdate[] } | { success: false; error: string };

// `apt list --upgradable` lines look like:
//   libssl3/stable-security 3.0.17-1~deb13u1 arm64 [upgradable from: 3.0.16-1]
const UPGRADABLE_LINE = /^([^/\s]+)\/\S+\s+(\S+)\s+\S+\s+\[upgradable from: (\S+)\]/;

export async function checkForUpdates(): Promise<UpdateCheckResult> {
  try {
    // apt-get update over a Pi's SD card and network can take a minute or two.
    await execFileAsync('sudo', [CHECK_UPDATES_SCRIPT], { timeout: 180_000 });
    const { stdout } = await execFileAsync('apt', ['list', '--upgradable'], { timeout: 30_000 });
    const updates: PendingUpdate[] = [];
    for (const line of stdout.split('\n')) {
      const match = UPGRADABLE_LINE.exec(line);
      if (match) {
        updates.push({ name: match[1], to: match[2], from: match[3] });
      }
    }
    return { success: true, updates };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Could not check for updates' };
  }
}

export async function startUpdates(): Promise<SystemControlResult> {
  return runSudoCommand([START_UPDATES_SCRIPT]);
}

export type UpdateStatus = {
  state: 'idle' | 'running' | 'succeeded' | 'failed';
  log: string;
  rebootRequired: boolean;
};

// Reads back the transient unit start-updates.sh created; needs no privilege.
export async function getUpdateStatus(): Promise<UpdateStatus> {
  const rebootRequired = existsSync('/var/run/reboot-required');
  let state: UpdateStatus['state'] = 'idle';
  try {
    const { stdout } = await execFileAsync(
      'systemctl',
      ['show', UPGRADE_UNIT, '-p', 'ActiveState', '-p', 'Result', '--value'],
      { timeout: 10_000 },
    );
    const [activeState, result] = stdout.trim().split('\n');
    if (activeState === 'active' || activeState === 'activating') {
      state = 'running';
    } else if (result === 'success') {
      state = 'succeeded';
    } else if (result && result !== 'success' && activeState === 'failed') {
      state = 'failed';
    }
  } catch {
    // Unit doesn't exist (no upgrade has been started since boot) — stays 'idle'.
  }
  let log = '';
  if (state !== 'idle') {
    try {
      const { stdout } = await execFileAsync('journalctl', ['-u', UPGRADE_UNIT, '-n', '6', '--no-pager', '-o', 'cat'], {
        timeout: 10_000,
      });
      log = stdout.trim();
    } catch {
      // Not in a group allowed to read the journal — the state alone is still useful.
    }
  }
  return { state, log, rebootRequired };
}

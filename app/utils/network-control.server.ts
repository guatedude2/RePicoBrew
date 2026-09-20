import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { promisify } from 'node:util';
import { withWifiRadioLock } from '~/utils/wifi.server';

const execFileAsync = promisify(execFile);

export type NetworkControlResult = { success: true } | { success: false; error: string };

// Same shape and rationale as app/utils/system-control.server.ts: execFile (never a shell) so
// there's no metacharacter-injection risk from the hostname/SSID/password values below, backed by
// the narrowly-scoped passwordless sudo rules pi-image/chroot-provision.sh installs into
// /etc/sudoers.d/repicobrew-control. Unlike that file's fixed-argv commands, these DO take
// user-supplied values — the safety net here is that each script validates its own arguments
// (see scripts/network/*.sh) before touching anything, since the sudoers rule itself can't.
const HOSTNAME_SCRIPT = '/usr/local/sbin/repicobrew-network/apply-hostname.sh';
const AP_SCRIPT = '/usr/local/sbin/repicobrew-network/apply-ap.sh';
const WIFI_SCRIPT = '/usr/local/sbin/repicobrew-network/apply-wifi.sh';

async function runSudoScript(script: string, args: readonly string[], timeout: number): Promise<NetworkControlResult> {
  // Stock Raspberry Pi OS installs (scripts/deploy-to-pi.sh) don't have these image-baked scripts:
  // the OS itself manages networking there, so there's nothing for us to apply. Treat that as a
  // no-op success — the Wi-Fi step still verifies real internet access afterwards.
  if (!existsSync(script)) {
    console.warn(`[network-control] ${script} not installed; skipping (network managed by the OS)`);
    return { success: true };
  }
  try {
    await execFileAsync('sudo', [script, ...args], { timeout });
    return { success: true };
  } catch (error) {
    // Expected and harmless on a non-Pi dev machine (no `pi` user, no sudoers rule, no script
    // installed) — surface it as a normal error result rather than letting it throw out of an
    // action and crash the request.
    return { success: false, error: error instanceof Error ? error.message : 'Command failed' };
  }
}

export async function applyHostname(hostname: string): Promise<NetworkControlResult> {
  return runSudoScript(HOSTNAME_SCRIPT, [hostname], 10_000);
}

export async function applyAccessPoint(ssid: string, password: string): Promise<NetworkControlResult> {
  return runSudoScript(AP_SCRIPT, [ssid, password], 10_000);
}

export async function applyWifi(ssid: string, password: string): Promise<NetworkControlResult> {
  // Shares wifi.server.ts's radio lock with listNearbyNetworks() — a scan overlapping with a real
  // join (dhcpcd/wpa_supplicant restart) was observed to destabilize the radio badly enough to
  // take the whole access point down. dhcpcd restart + association + DHCP lease acquisition can
  // also take a few seconds longer than the other two scripts' near-instant service restarts.
  return withWifiRadioLock(() => runSudoScript(WIFI_SCRIPT, [ssid, password], 20_000));
}

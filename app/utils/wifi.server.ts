import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { isRaspberryPi } from '~/utils/platform.server';

const execFileAsync = promisify(execFile);

export type NearbyNetwork = { ssid: string; signal: number; secured: boolean };

// Real Wi-Fi scanning only makes sense on the actual Pi hardware this server runs on — `nmcli`
// ships with Raspberry Pi OS's default NetworkManager stack, so it's used directly rather than
// the older `iwlist`/`iw` tools. Any failure (nmcli missing, no adapter, insufficient permissions,
// scan timeout) falls back to an empty list so the Wi-Fi setup step just drops to manual SSID
// entry instead of erroring the whole wizard.
export async function listNearbyNetworks(): Promise<NearbyNetwork[]> {
  if (!isRaspberryPi()) {
    return [];
  }
  try {
    const { stdout } = await execFileAsync(
      'nmcli',
      ['-t', '-f', 'SSID,SIGNAL,SECURITY', 'dev', 'wifi', 'list', '--rescan', 'yes'],
      { timeout: 15000 },
    );
    // Terse mode separates fields with unescaped ':' — good enough for real-world SSIDs, which
    // essentially never contain a literal colon.
    const strongestBySsid = new Map<string, NearbyNetwork>();
    for (const line of stdout.split('\n')) {
      const [ssid, signalRaw, security] = line.split(':');
      if (!ssid) {
        continue; // hidden/blank SSID entries
      }
      const signal = parseInt(signalRaw, 10) || 0;
      const existing = strongestBySsid.get(ssid);
      if (!existing || signal > existing.signal) {
        strongestBySsid.set(ssid, { ssid, signal, secured: !!security && security !== '--' });
      }
    }
    return [...strongestBySsid.values()].sort((a, b) => b.signal - a.signal);
  } catch {
    return [];
  }
}

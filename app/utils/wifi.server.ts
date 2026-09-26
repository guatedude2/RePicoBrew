import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { isRaspberryPi } from '~/utils/platform.server';
import fs from 'node:fs';

const execFileAsync = promisify(execFile);

export type NearbyNetwork = { ssid: string; signal: number; secured: boolean };

// wpa_cli prints non-printable/non-ASCII SSID bytes as \xNN escapes (a hidden network shows up as
// "\x00\x00…"). Decode them back to real text; an SSID that's nothing but NULs is a hidden network
// and comes back empty so callers skip it.
function decodeSsid(raw: string): string {
  const bytes: number[] = [];
  for (let i = 0; i < raw.length; ) {
    const escape = /^\\x([0-9a-fA-F]{2})/.exec(raw.slice(i, i + 4));
    if (escape) {
      bytes.push(parseInt(escape[1], 16));
      i += 4;
    } else {
      bytes.push(raw.charCodeAt(i) & 0xff);
      i += 1;
    }
  }
  return Buffer.from(bytes).toString('utf8').replace(/\0/g, '');
}

// Serializes every operation in this app that touches the Wi-Fi radios (scanning, joining a network): a scan
// overlapping a join can knock the radio, and with it the access point, over. Every caller chains onto this
// promise instead of running concurrently; also used by app/utils/network-control.server.ts's applyWifi.
let wifiRadioLock: Promise<unknown> = Promise.resolve();
export function withWifiRadioLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = wifiRadioLock.then(fn, fn);
  wifiRadioLock = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

// Which radio to scan with. Scanning makes a radio leave its channel for a moment, which drops the weaker
// PicoBrew devices from the access point — so with a second radio (a USB dongle) it scans with that one and
// never touches the built-in radio hosting the access point. Same rule as scripts/network/wifi-radios.sh:
// the AP radio is the first non-USB one; with only one radio there's no choice but to scan on it.
function scanRadio(): string {
  try {
    const radios = fs
      .readdirSync('/sys/class/net')
      .filter((name) => fs.existsSync(`/sys/class/net/${name}/wireless`))
      .sort();
    const isUsb = (name: string) => fs.realpathSync(`/sys/class/net/${name}/device/subsystem`).endsWith('/usb');
    const apRadio = radios.find((name) => !isUsb(name)) ?? radios[0];
    return radios.find((name) => name !== apRadio) ?? apRadio ?? 'wlan0';
  } catch {
    return 'wlan0';
  }
}

// Real Wi-Fi scanning only makes sense on the actual Pi hardware this server runs on. Uses
// `wpa_cli` against the radio's own wpa_supplicant control socket rather than `nmcli`. `wpa_cli` needs no
// extra privilege as long as `pi` is in the `netdev` group (the Pi image adds it). Any failure (wpa_supplicant not running
// yet, no adapter, scan timeout) falls back to an empty list so the Wi-Fi setup step just drops to
// manual SSID entry instead of erroring the whole wizard.
export async function listNearbyNetworks(): Promise<NearbyNetwork[]> {
  if (!isRaspberryPi()) {
    return [];
  }
  const radio = scanRadio();
  return withWifiRadioLock(async () => {
    try {
      await execFileAsync('wpa_cli', ['-i', radio, 'scan'], { timeout: 5000 });
      // Give the radio a moment to actually complete the scan before asking for results.
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const { stdout } = await execFileAsync('wpa_cli', ['-i', radio, 'scan_results'], { timeout: 5000 });
      // Header line is "bssid / frequency / signal level / flags / ssid", tab-separated.
      const strongestBySsid = new Map<string, NearbyNetwork>();
      for (const line of stdout.split('\n').slice(1)) {
        const [, , signalRaw, flags, rawSsid] = line.split('\t');
        const ssid = rawSsid ? decodeSsid(rawSsid) : '';
        if (!ssid) {
          continue; // hidden/blank SSID entries
        }
        // wpa_cli reports raw dBm (typically -30 to -90); normalize to a 0-100 "signal" scale to
        // match the shape callers/WifiNetworkPicker already expect.
        const dbm = parseInt(signalRaw, 10) || -100;
        const signal = Math.max(0, Math.min(100, 2 * (dbm + 100)));
        const secured = /WPA|WEP/.test(flags ?? '');
        const existing = strongestBySsid.get(ssid);
        if (!existing || signal > existing.signal) {
          strongestBySsid.set(ssid, { ssid, signal, secured });
        }
      }
      return [...strongestBySsid.values()].sort((a, b) => b.signal - a.signal);
    } catch (error) {
      console.error('[wifi.server] listNearbyNetworks failed:', error);
      return [];
    }
  });
}

// Run from the Node server itself (not the browser) — it's the server process that needs a real
// route for AI provider calls (see app/services/ai-advisor.server.ts), so this is what the Setup
// wizard's Wi-Fi step and Settings' Wi-Fi save actually gate on, rather than just saving a
// name/password to the database and hoping. A short-timeout request against a lightweight,
// well-known endpoint, retried a handful of times — joining a network (association + DHCP lease)
// takes a few seconds, so a single immediate check would false-negative on a perfectly good join.
export async function checkInternetConnectivity(
  options: { retries?: number; delayMs?: number; timeoutMs?: number } = {},
): Promise<boolean> {
  const { retries = 8, delayMs = 2000, timeoutMs = 4000 } = options;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch('https://connectivitycheck.gstatic.com/generate_204', {
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (response.ok || response.status === 204) {
        return true;
      }
    } catch {
      // Not connected yet (or DNS/route still settling) — fall through to retry.
    }
    if (attempt < retries - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return false;
}

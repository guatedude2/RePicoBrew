import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { isRaspberryPi } from '~/utils/platform.server';

const execFileAsync = promisify(execFile);

const normalizeMac = (mac: string): string => mac.trim().toLowerCase();

// One ping at a registered device's last-known IP — cheap enough to run per device on every
// tick without leaning on a Pi Zero W's single core, unlike sweeping the whole subnet. This also
// populates the kernel's neighbor table for that IP as a side effect, which readNeighborTable
// then reads back.
async function pingHost(ip: string): Promise<boolean> {
  try {
    await execFileAsync('ping', ['-c', '1', '-W', '1', ip], { timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

// `ip neigh` (iproute2) rather than the legacy net-tools `arp -a`, which Raspberry Pi OS
// Bookworm no longer installs by default.
async function readNeighborTable(): Promise<Map<string, string>> {
  const macByIp = new Map<string, string>();
  try {
    const { stdout } = await execFileAsync('ip', ['neigh', 'show'], { timeout: 3000 });
    for (const line of stdout.split('\n')) {
      // e.g. "192.168.1.42 dev wlan0 lladdr aa:bb:cc:dd:ee:ff REACHABLE"
      const match = line.match(/^(\S+)\s+dev\s+\S+\s+lladdr\s+(\S+)\s+(\S+)/);
      if (!match) {
        continue;
      }
      const [, ip, mac, state] = match;
      if (state === 'FAILED' || state === 'INCOMPLETE') {
        continue;
      }
      macByIp.set(ip, normalizeMac(mac));
    }
  } catch {
    // `ip` missing or the command failed — caller treats an empty table as "couldn't confirm".
  }
  return macByIp;
}

export type DeviceNetworkCheck = { reachable: boolean; macAddress: string | null; ipAddress: string | null };

// Confirms whether a device is actually present on the LAN right now, since these devices don't
// run anything we could call to ask directly: pings its last-known IP, then cross-checks the
// neighbor table's MAC at that IP. If the ping fails but we already have this device's MAC on
// file, falls back to searching the whole table for that MAC — catching a DHCP lease renewal
// that handed the device a new IP — and reports the IP it found so the caller can self-heal the
// stored ipAddress instead of tracking a now-stale one.
export async function checkDeviceOnNetwork(known: {
  ipAddress: string | null;
  macAddress: string | null;
}): Promise<DeviceNetworkCheck> {
  if (!isRaspberryPi() || !known.ipAddress) {
    return { reachable: false, macAddress: known.macAddress, ipAddress: known.ipAddress };
  }

  const alive = await pingHost(known.ipAddress);
  const table = await readNeighborTable();
  const macAtKnownIp = table.get(known.ipAddress) ?? null;

  if (alive || macAtKnownIp) {
    return { reachable: true, macAddress: macAtKnownIp ?? known.macAddress, ipAddress: known.ipAddress };
  }

  if (known.macAddress) {
    const relocatedIp = [...table.entries()].find(([, mac]) => mac === known.macAddress)?.[0] ?? null;
    if (relocatedIp) {
      return { reachable: true, macAddress: known.macAddress, ipAddress: relocatedIp };
    }
  }

  return { reachable: false, macAddress: known.macAddress, ipAddress: known.ipAddress };
}

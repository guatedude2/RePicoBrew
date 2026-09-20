import fs from 'node:fs';
import os from 'node:os';
// Server-only module importing package.json for the app's own version — resolveJsonModule
// (tsconfig.json) plus Vite's native JSON import support make this a plain object import, not a
// filesystem read, so it stays correct even if the working directory changes at runtime.
import packageJson from '../../package.json';

export type OsRelease = Record<string, string>;

export type NetworkAddress = { interfaceName: string; address: string; family: 'IPv4' | 'IPv6' };

export type SystemInfo = {
  hostname: string;
  ipAddresses: NetworkAddress[];
  appVersion: string;
  osRelease: OsRelease | null;
};

// `/etc/os-release` is simple KEY=VALUE lines, values sometimes quoted — this is the same format
// systemd/most Linux distros use, no dedicated parser needed. Not present on macOS, so callers
// should treat a null return as "unknown OS" rather than an error.
function parseOsRelease(content: string): OsRelease {
  const result: OsRelease = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) {
      continue;
    }
    const key = trimmed.slice(0, eqIndex);
    let value = trimmed.slice(eqIndex + 1);
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

export function getOsRelease(): OsRelease | null {
  try {
    const content = fs.readFileSync('/etc/os-release', 'utf8');
    return parseOsRelease(content);
  } catch {
    // Doesn't exist on macOS/most non-Linux dev machines, or a stripped-down Linux without it —
    // either way, the System tab should just render "Unknown" rather than fail the whole loader.
    return null;
  }
}

// Only non-internal addresses are useful here — this is meant to answer "what IP would I type
// into a browser to reach this server", and 127.0.0.1/::1 never are.
export function getIpAddresses(): NetworkAddress[] {
  const interfaces = os.networkInterfaces();
  const addresses: NetworkAddress[] = [];
  for (const [interfaceName, entries] of Object.entries(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.internal) {
        continue;
      }
      addresses.push({ interfaceName, address: entry.address, family: entry.family });
    }
  }
  return addresses;
}

export function getSystemInfo(): SystemInfo {
  return {
    hostname: os.hostname(),
    ipAddresses: getIpAddresses(),
    appVersion: packageJson.version,
    osRelease: getOsRelease(),
  };
}

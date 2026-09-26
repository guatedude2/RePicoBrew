import fs from 'fs';

// Access Point / Wi-Fi settings only make sense when this server is actually running on the Pi
// whose NetworkManager it would be managing — hide those tabs everywhere else (e.g. a dev
// machine). Detected via the device-tree model file Linux exposes on Raspberry Pi boards, falling
// back to the /proc/cpuinfo "Hardware"/"Model" line older Raspbian images use instead.
export function isRaspberryPi(): boolean {
  if (process.platform !== 'linux') {
    return false;
  }

  try {
    const model = fs.readFileSync('/proc/device-tree/model', 'utf8');
    if (/raspberry pi/i.test(model)) {
      return true;
    }
  } catch {
    // /proc/device-tree doesn't exist on this kernel — fall through to /proc/cpuinfo.
  }

  try {
    const cpuinfo = fs.readFileSync('/proc/cpuinfo', 'utf8');
    return /raspberry pi/i.test(cpuinfo);
  } catch {
    return false;
  }
}

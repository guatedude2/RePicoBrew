/* eslint-disable no-var */
import { DeviceRepository } from '~/repositories/device.server';
import { DeviceType } from '~/types';
import { checkDeviceOnNetwork } from '~/utils/device-network.server';
import pubsub from './pubsub.server';

const TICK_MS = 60 * 1000;

// Only device types that carry their own IP on the LAN can be corroborated this way — Tilt is a
// Bluetooth-only hydrometer with no IP of its own, so it relies solely on lastSeenAt, bumped
// whenever a BLE reading comes in via tilt.server.ts.
const NETWORK_CHECKED_TYPES: string[] = [
  DeviceType.PICOBREW,
  DeviceType.PICOBREW_C,
  DeviceType.ZYMATIC,
  DeviceType.ZSERIES,
  DeviceType.PICOFERM,
  DeviceType.ISPINDEL,
];

// Tracks the last known online/offline state per device id so a tick only publishes when
// something actually changed, rather than an event every minute for every device.
const lastKnownOnline = new Map<number, boolean>();

// Refreshes lastSeenAt/macAddress/ipAddress for a network-capable device via an active LAN
// check, since it won't necessarily have polled us again since the last tick.
async function refreshFromNetwork(device: {
  id: number;
  ipAddress: string | null;
  macAddress: string | null;
}): Promise<void> {
  const result = await checkDeviceOnNetwork({ ipAddress: device.ipAddress, macAddress: device.macAddress });

  if (result.macAddress && result.macAddress !== device.macAddress) {
    await DeviceRepository.updateDeviceMacAddress(device.id, result.macAddress);
  }
  if (result.ipAddress && result.ipAddress !== device.ipAddress) {
    await DeviceRepository.updateDeviceIPAddress(device.id, result.ipAddress);
  }
  if (result.reachable) {
    await DeviceRepository.touchLastSeen(device.id);
  }
}

// Publishes only when a device's online/offline state actually flipped since the last tick, so
// open pages aren't re-rendered every minute for every device.
function publishIfChanged(device: { id: number; uid: string }, nowOnline: boolean) {
  const wasOnline = lastKnownOnline.get(device.id);
  if (wasOnline !== nowOnline) {
    lastKnownOnline.set(device.id, nowOnline);
    pubsub.publish('device-availability-update', { uid: device.uid, online: nowOnline });
  }
}

async function runTick() {
  const devices = await DeviceRepository.listDevices();
  for (const device of devices) {
    try {
      if (NETWORK_CHECKED_TYPES.includes(device.deviceType)) {
        await refreshFromNetwork(device);
      }
      // Re-fetch: refreshFromNetwork may have just bumped lastSeenAt above. Types with no active
      // check (Tilt) fall straight through to this recency read against their BLE heartbeat.
      const current = await DeviceRepository.getDeviceById(device.id);
      if (current) {
        publishIfChanged(device, DeviceRepository.isDeviceOnline(current));
      }
    } catch (error) {
      console.error(`[device-monitor] tick failed for device ${device.id}`, error);
    }
  }
}

declare global {
  var __deviceMonitorStarted: boolean | undefined;
}

// Side-effect module: importing this once (from app/routes/_admin.tsx) starts the interval.
// Guarded the same way app/services/ai-scheduler.server.ts guards its singleton, so Vite's
// dev-mode module reloads don't stack up duplicate intervals.
if (!global.__deviceMonitorStarted) {
  global.__deviceMonitorStarted = true;
  setInterval(() => {
    void runTick();
  }, TICK_MS);
}

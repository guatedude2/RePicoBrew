import { DeviceRepository } from '~/repositories/device.server';
import { SessionRepository } from '~/repositories/session.server';
import { DeviceType } from '~/types';
import pubsub from './pubsub.server';

// Tilt color UUID mapping (iBeacon UUIDs)
export const TILT_COLOR_UUIDS: Record<string, string> = {
  a495bb10c5b14b44b5121370f02d74de: 'Red',
  a495bb20c5b14b44b5121370f02d74de: 'Green',
  a495bb30c5b14b44b5121370f02d74de: 'Black',
  a495bb40c5b14b44b5121370f02d74de: 'Purple',
  a495bb50c5b14b44b5121370f02d74de: 'Orange',
  a495bb60c5b14b44b5121370f02d74de: 'Blue',
  a495bb70c5b14b44b5121370f02d74de: 'Yellow',
  a495bb80c5b14b44b5121370f02d74de: 'Pink',
};

export interface TiltReading {
  color: string;
  temp: number; // °F
  gravity: number; // e.g. 1050 or 10500
  rssi?: number;
  timestamp?: string;
  uid?: string; // {Color}{MAC} or just color as fallback
  mac?: string;
}

/**
 * Normalize gravity based on Tilt Classic vs Pro format
 */
function normalizeGravity(rawGravity: number): number {
  if (rawGravity > 2000) {
    // Pro format: divide by 10000
    return rawGravity / 10000;
  }
  // Classic format: divide by 1000
  return rawGravity / 1000;
}

/**
 * Normalize temperature (Pro sends temp * 10, Classic sends directly)
 */
function normalizeTemp(rawTemp: number, rawGravity: number): number {
  if (rawGravity > 2000) {
    // Pro format
    return rawTemp / 10;
  }
  return rawTemp;
}

/**
 * Process a Tilt reading from BLE or HTTP POST
 * - Auto-registers device if not found
 * - Logs reading if an active session exists
 * - Publishes tilt-update event
 */
export async function processTiltReading(reading: TiltReading) {
  const { color, temp: rawTemp, gravity: rawGravity, rssi, uid, mac } = reading;

  // Normalize values
  const temp = normalizeTemp(rawTemp, rawGravity);
  const gravity = normalizeGravity(rawGravity);

  // Construct device UID: prefer {Color}{MAC}, fallback to color only
  const deviceUID = uid || (mac ? `${color}${mac.replace(/:/g, '')}` : color);

  // Find device — unclaimed uids are recorded as Discovered, not auto-created.
  const device = await DeviceRepository.getDeviceByUID(deviceUID);
  if (!device) {
    console.log(`[Tilt] New device detected: ${deviceUID} (${color})`);
    await DeviceRepository.upsertDiscoveredDevice(deviceUID, DeviceType.TILT, { color });
    pubsub.publish('device-detected', { uid: deviceUID, deviceType: DeviceType.TILT, isRegistered: false });
    return { device: null, session: null, temp, gravity };
  }

  // Find active session for this device
  const session = await SessionRepository.getLastActiveSessionByDeviceId(device.id);

  if (session) {
    // Log the reading
    const logData = {
      time: reading.timestamp ? new Date(reading.timestamp).getTime() : Date.now(),
      temp,
      gravity,
      ...(rssi !== undefined && { rssi }),
      resolution: rawGravity > 2000 ? 'high' : 'low',
    };

    await SessionRepository.createSessionLogEntry(session.id, logData, 1); // type 1 = ferment log

    // Publish live update
    pubsub.publish('tilt-update', {
      sessionId: session.id,
      deviceId: device.id,
      uid: deviceUID,
      color,
      temp,
      gravity,
      rssi,
    });

    console.log(`[Tilt] Logged reading for ${color}: SG ${gravity.toFixed(3)}, ${temp.toFixed(1)}°F`);
  } else {
    // No active session, but still publish device-seen event
    pubsub.publish('tilt-seen', { uid: deviceUID, color, temp, gravity, rssi });
  }

  return { device, session, temp, gravity };
}

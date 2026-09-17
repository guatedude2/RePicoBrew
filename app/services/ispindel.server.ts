import { DeviceRepository } from '~/repositories/device.server';
import { SessionRepository } from '~/repositories/session.server';
import { DeviceType } from '~/types';
import pubsub from './pubsub.server';

export interface ISpindelReading {
  name?: string;
  ID: number; // device identity - used as the device uid (String(ID))
  angle?: number; // floatation angle - no RePicoBrew field today, stored in the log JSON as-is
  temperature: number;
  temp_units: 'C' | 'F';
  battery: number; // voltage
  gravity: number; // pre-computed specific gravity - no calibration/formula needed here
  interval?: number; // sampling interval, seconds
  RSSI?: number;
}

function celsiusToFahrenheit(celsius: number): number {
  return (celsius * 9) / 5 + 32;
}

/**
 * Process an iSpindel reading from HTTP POST
 * - Auto-registers device if not found
 * - Logs reading if an active session exists (same pattern as processTiltReading)
 * - Publishes ispindel-update / ispindel-seen events
 */
export async function processISpindelReading(reading: ISpindelReading) {
  const { ID, name, angle, temperature, temp_units, battery, gravity, RSSI, interval } = reading;

  const uid = String(ID);
  // Always store temp as °F, matching how the rest of RePicoBrew's fermentation data is stored.
  const temp = temp_units === 'F' ? temperature : celsiusToFahrenheit(temperature);

  const device = await DeviceRepository.getDeviceByUID(uid);
  if (!device) {
    // Unclaimed — record the sighting so it shows up in the Devices page's Discovered list, but
    // don't create a real Device or store any reading until an admin pairs it.
    console.log(`[iSpindel] New device detected: ${uid}`);
    await DeviceRepository.upsertDiscoveredDevice(uid, DeviceType.ISPINDEL, name ? { name } : undefined);
    pubsub.publish('device-detected', { uid, deviceType: DeviceType.ISPINDEL, isRegistered: false });
    return { device: null, session: null, temp, gravity };
  }
  await DeviceRepository.touchLastSeen(device.id);

  // Find active session for this device
  const session = await SessionRepository.getLastActiveSessionByDeviceId(device.id);

  if (session) {
    const logData = {
      time: Date.now(),
      temp,
      gravity,
      battery,
      ...(angle !== undefined && { angle }),
      ...(interval !== undefined && { interval }),
      ...(RSSI !== undefined && { rssi: RSSI }),
    };

    await SessionRepository.createSessionLogEntry(session.id, logData, 1); // type 1 = ferment log

    pubsub.publish('ispindel-update', {
      sessionId: session.id,
      deviceId: device.id,
      uid,
      temp,
      gravity,
      battery,
      rssi: RSSI,
    });

    console.log(`[iSpindel] Logged reading for ${uid}: SG ${gravity.toFixed(3)}, ${temp.toFixed(1)}°F`);
  } else {
    // No active session, but still publish device-seen event
    pubsub.publish('ispindel-seen', { uid, temp, gravity, battery, rssi: RSSI });
  }

  return { device, session, temp, gravity };
}

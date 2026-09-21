import type { ActionFunctionArgs } from 'react-router';
import { data } from 'react-router';
import { processTiltReading } from '~/services/tilt.server';
import { TILT_COLOR_UUIDS } from '~/utils/tilt-colors';

/**
 * POST /API/tilt-ble
 *
 * Raw readings from the on-device Bluetooth scanner (workers/tilt-ble.ts), which runs as its own
 * service. `temp` and `gravity` are the beacon's raw major/minor values (°F and SG*1000 for a Tilt
 * Classic, both x10 for a Pro) — processTiltReading normalises them, unlike /API/tilt which expects
 * pytilt's Celsius. The scanner calls the app directly on localhost; anything that arrived through
 * the nginx proxy (which sets forwarding headers) is refused, so devices on the access point can't
 * inject readings here.
 */
export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return data({ error: 'Method not allowed' }, { status: 405 });
  }
  if (request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')) {
    return data({ error: 'Forbidden' }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    color?: unknown;
    mac?: unknown;
    temp?: unknown;
    gravity?: unknown;
    rssi?: unknown;
  } | null;
  const color = typeof body?.color === 'string' ? body.color : '';
  const mac = typeof body?.mac === 'string' ? body.mac : '';
  const temp = Number(body?.temp);
  const gravity = Number(body?.gravity);
  if (!Object.values(TILT_COLOR_UUIDS).includes(color) || !mac || !Number.isFinite(temp) || !Number.isFinite(gravity)) {
    return data({ error: 'Expected { color, mac, temp, gravity, rssi? }' }, { status: 400 });
  }

  const result = await processTiltReading({
    color,
    temp,
    gravity,
    rssi: typeof body?.rssi === 'number' ? body.rssi : undefined,
    mac,
    uid: `${color}${mac.replace(/:/g, '')}`,
    timestamp: new Date().toISOString(),
  });
  return { claimed: !!result.device, sessionActive: !!result.session };
}

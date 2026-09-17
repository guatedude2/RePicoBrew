import type { ActionFunctionArgs } from 'react-router';
import { data } from 'react-router';
import { processTiltReading } from '~/services/tilt.server';

/**
 * POST /API/tilt
 *
 * Accepts Tilt readings from HTTP clients (e.g., pytilt, local testing)
 *
 * Body format (array):
 * [
 *   {
 *     "color": "Black",
 *     "temp": 21.5,      // °C (will be converted to °F)
 *     "gravity": 1050,
 *     "timestamp": "2024-01-01T00:00:00Z",
 *     "uid": "BlackA1B2C3D4E5F6",
 *     "rssi": -67
 *   }
 * ]
 */
export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return data({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const readings = await request.json();

    if (!Array.isArray(readings)) {
      return data({ error: 'Expected array of readings' }, { status: 400 });
    }

    const results = [];

    for (const reading of readings) {
      const { color, temp, gravity, timestamp, uid, rssi } = reading;

      if (!color || temp === undefined || gravity === undefined) {
        results.push({ error: 'Missing required fields: color, temp, gravity' });
        continue;
      }

      // Convert °C to °F (pytilt sends Celsius)
      const tempF = (temp * 9) / 5 + 32;

      const result = await processTiltReading({
        color,
        temp: tempF,
        gravity,
        timestamp,
        uid,
        rssi,
      });

      results.push({
        color,
        deviceId: result.device?.id ?? null,
        claimed: !!result.device,
        sessionActive: !!result.session,
      });
    }

    return { success: true, results };
  } catch (error) {
    console.error('[Tilt API] Error processing readings:', error);
    return data({ error: 'Failed to process readings' }, { status: 500 });
  }
}

import type { ActionFunctionArgs } from 'react-router';
import { processISpindelReading } from '~/services/ispindel.server';

/**
 * POST /API/iSpindel
 *
 * Accepts an iSpindel reading (also bound at /api/ispindle for the real firmware's historical
 * typo - see api.ispindle.ts).
 *
 * Body:
 * {
 *   "name": "MySpindel",       // optional
 *   "ID": 123456,              // required - device identity, used as uid
 *   "angle": 45.2,             // optional
 *   "temperature": 20.5,       // required
 *   "temp_units": "C",         // required, "C" | "F"
 *   "battery": 3.7,            // required - voltage
 *   "gravity": 1.05,           // required - pre-computed specific gravity
 *   "interval": 900,           // optional - seconds
 *   "RSSI": -60                // optional
 * }
 *
 * Response: empty 200 OK, no body, always - real iSpindel firmware expects no wire-format ack.
 */
export async function action({ request }: ActionFunctionArgs) {
  try {
    const data = await request.json();
    const { ID, temperature, temp_units, battery, gravity } = data ?? {};

    if (
      ID === undefined ||
      temperature === undefined ||
      temp_units === undefined ||
      battery === undefined ||
      gravity === undefined
    ) {
      console.error('[iSpindel API] Missing required fields on reading:', data);
      return new Response(null, { status: 200 });
    }

    await processISpindelReading(data);
  } catch (error) {
    console.error('[iSpindel API] Error processing reading:', error);
  }

  return new Response(null, { status: 200 });
}

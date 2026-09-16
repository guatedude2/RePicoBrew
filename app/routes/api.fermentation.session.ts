import type { ActionArgs, LoaderArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { DeviceRepository } from '~/repositories/device.server';
import { SessionRepository, SessionState, SessionType } from '~/repositories/session.server';
import { DeviceType } from '~/types';

/**
 * GET /api/fermentation/devices
 * List all Tilt devices
 */
export async function loader(_args: LoaderArgs) {
  const devices = await DeviceRepository.listDevices();
  const tiltDevices = devices.filter((d) => d.deviceType === DeviceType.TILT);

  const devicesWithSessions = await Promise.all(
    tiltDevices.map(async (device) => {
      const activeSession = await SessionRepository.getLastActiveSessionByDeviceId(device.id);
      return {
        ...device,
        activeSession: activeSession && activeSession.state === SessionState.IN_PROGRESS ? activeSession : null,
      };
    }),
  );

  return json({ devices: devicesWithSessions });
}

/**
 * POST /api/fermentation/session
 * Start or stop a fermentation session
 *
 * Body:
 * - action: "start" | "stop"
 * - deviceId: number
 */
export async function action({ request }: ActionArgs) {
  const body = await request.json();
  const { action: actionType, deviceId } = body;

  if (!actionType || !deviceId) {
    return json({ error: 'Missing required fields: action, deviceId' }, { status: 400 });
  }

  const device = await DeviceRepository.getDeviceByUID(String(deviceId));
  if (!device) {
    return json({ error: 'Device not found' }, { status: 404 });
  }

  if (device.deviceType !== DeviceType.TILT) {
    return json({ error: 'Device is not a Tilt hydrometer' }, { status: 400 });
  }

  try {
    if (actionType === 'start') {
      // Check if there's already an active session
      const existingSession = await SessionRepository.getLastActiveSessionByDeviceId(device.id);
      if (existingSession && existingSession.state === SessionState.IN_PROGRESS) {
        return json({ error: 'A fermentation session is already active for this device' }, { status: 400 });
      }

      // Create a new fermentation session
      const uid = `FERMENT-${Date.now()}-${device.uid}`;
      const session = await SessionRepository.createSession(
        uid,
        SessionType.FERMENTATION,
        device.id,
        undefined, // No recipe for fermentation
        undefined, // No time remaining
      );

      // Start the session immediately
      await SessionRepository.startSession(session.id);

      return json({ success: true, session });
    } else if (actionType === 'stop') {
      // Find the active session
      const session = await SessionRepository.getLastActiveSessionByDeviceId(device.id);
      if (!session || session.state !== SessionState.IN_PROGRESS) {
        return json({ error: 'No active session found for this device' }, { status: 404 });
      }

      // Complete the session
      await SessionRepository.completeSession(session.id);

      return json({ success: true, session: { ...session, state: SessionState.COMPLETED } });
    }
    return json({ error: 'Invalid action. Use "start" or "stop"' }, { status: 400 });
  } catch (error) {
    console.error('[Fermentation API] Error:', error);
    return json({ error: 'Failed to process request' }, { status: 500 });
  }
}

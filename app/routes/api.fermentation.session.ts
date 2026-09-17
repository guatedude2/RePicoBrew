import type { ActionArgs, LoaderArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { BatchRepository } from '~/repositories/batch.server';
import { DeviceRepository } from '~/repositories/device.server';
import { SessionRepository } from '~/repositories/session.server';
import { BatchPhase, SessionState, SessionType, DeviceType } from '~/types';

// Device types that can serve as a fermentation-tracking hydrometer/monitor and plug into this
// same session/batch lifecycle (Tilt, PicoFerm, iSpindel are functionally identical in this role).
const FERMENTATION_DEVICE_TYPES: DeviceType[] = [DeviceType.TILT, DeviceType.PICOFERM, DeviceType.ISPINDEL];

/**
 * GET /api/fermentation/devices
 * List all fermentation-tracking devices (Tilt, PicoFerm, iSpindel), plus batches currently
 * fermenting without a tracker yet
 */
export async function loader(_args: LoaderArgs) {
  const devices = await DeviceRepository.listDevices();
  const tiltDevices = devices.filter((d) => FERMENTATION_DEVICE_TYPES.includes(d.deviceType as DeviceType));

  const devicesWithSessions = await Promise.all(
    tiltDevices.map(async (device) => {
      const activeSession = await SessionRepository.getLastActiveSessionByDeviceId(device.id);
      return {
        ...device,
        activeSession: activeSession && activeSession.state === SessionState.IN_PROGRESS ? activeSession : null,
      };
    }),
  );

  const awaitingBatches = await BatchRepository.listAwaitingFermentationTracker();

  return json({ devices: devicesWithSessions, awaitingBatches });
}

/**
 * POST /api/fermentation/session
 * Start or stop a fermentation session
 *
 * Body:
 * - action: "start" | "stop"
 * - deviceId: number
 * - batchId?: number — batch to attach this tracking session to (start only)
 */
export async function action({ request }: ActionArgs) {
  const body = await request.json();
  const { action: actionType, deviceId, batchId } = body;

  if (!actionType || !deviceId) {
    return json({ error: 'Missing required fields: action, deviceId' }, { status: 400 });
  }

  const device = await DeviceRepository.getDeviceById(Number(deviceId));
  if (!device) {
    return json({ error: 'Device not found' }, { status: 404 });
  }

  if (!FERMENTATION_DEVICE_TYPES.includes(device.deviceType as DeviceType)) {
    return json({ error: 'Device is not a fermentation-tracking hydrometer' }, { status: 400 });
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

      // Attach to the given batch (if it's actually awaiting a tracker), else start a standalone batch
      const batch = batchId ? await BatchRepository.getBatch(Number(batchId)) : null;
      const targetBatch =
        batch && batch.phase === BatchPhase.FERMENTING
          ? batch
          : await BatchRepository.createBatch(`${device.name} tracking`, null);
      await BatchRepository.attachSession(targetBatch.id, session.id);

      return json({ success: true, session, batchId: targetBatch.id });
    } else if (actionType === 'stop') {
      // Find the active session
      const session = await SessionRepository.getLastActiveSessionByDeviceId(device.id);
      if (!session || session.state !== SessionState.IN_PROGRESS) {
        return json({ error: 'No active session found for this device' }, { status: 404 });
      }

      // Complete the session
      await SessionRepository.completeSession(session.id);
      if (session.batchId) {
        await BatchRepository.advancePhase(session.batchId, BatchPhase.FERMENTING, BatchPhase.BOTTLING);
      }

      return json({ success: true, session: { ...session, state: SessionState.COMPLETED } });
    }
    return json({ error: 'Invalid action. Use "start" or "stop"' }, { status: 400 });
  } catch (error) {
    console.error('[Fermentation API] Error:', error);
    return json({ error: 'Failed to process request' }, { status: 500 });
  }
}

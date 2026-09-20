import { BatchRepository } from '~/repositories/batch.server';
import { DeviceRepository } from '~/repositories/device.server';
import { RecipeRepository } from '~/repositories/recipe.server';
import { SessionRepository } from '~/repositories/session.server';
import prisma from '~/services/prisma.server';
import { DeviceType, SessionState, SessionType } from '~/types';
import { generatePakId } from '~/utils/pak';
import { QUEUED_STATUS_TEXT } from '~/utils/queued-brew';

// Pico S/C/Pro pick their recipe on the device; everything else is tracked manually (see
// app/pages/NewSession).
const QUEUEABLE_DEVICE_TYPES: string[] = [DeviceType.PICOBREW, DeviceType.PICOBREW_C];

type QueueResult = { ok: true; sessionId: number; recipeName: string } | { ok: false; error: string; status: number };

async function deleteQueuedSession(session: { id: number; batchId: number | null }) {
  if (session.batchId) {
    await BatchRepository.deleteBatch(session.batchId);
    return;
  }
  await prisma.sessionLog.deleteMany({ where: { sessionId: session.id } });
  await prisma.session.delete({ where: { id: session.id } });
}

// Queues `recipeId` for a Pico: creates the session (uid = the pak id the device will receive) and its
// batch up front, so the ferment device and carbonation settings chosen in the app are on the batch
// from the start. A device only ever has one queued brew — sending a second replaces the first.
export async function queueBrew(input: {
  deviceId: number;
  recipeId: number;
  fermentDeviceId: number | null;
  carbMethod: string;
  carbUnit: string;
  carbDuration: number;
}): Promise<QueueResult> {
  const device = await DeviceRepository.getDeviceById(input.deviceId);
  if (!device) {
    return { ok: false, error: 'Device not found', status: 404 };
  }
  if (!QUEUEABLE_DEVICE_TYPES.includes(device.deviceType)) {
    return { ok: false, error: 'This device starts its own brews — use manual tracking instead', status: 400 };
  }
  const recipe = await RecipeRepository.getRecipe(input.recipeId);
  if (!recipe) {
    return { ok: false, error: 'Recipe not found', status: 404 };
  }

  const existing = await SessionRepository.findQueuedBrew(device.id);
  if (existing) {
    await deleteQueuedSession(existing);
  }

  // Same encoding getAssociatedPaks/getRecipe use, so the device's pick maps straight onto this session.
  const uid = generatePakId(device.id, recipe.id, device.sessionCount + 1);
  const session = await SessionRepository.createSession(
    uid,
    SessionType.BREWING,
    device.id,
    recipe.id,
    undefined,
    QUEUED_STATUS_TEXT,
  );
  const batch = await BatchRepository.createBatch(recipe.name, recipe.id, {
    fermentDeviceId: input.fermentDeviceId,
    carbMethod: input.carbMethod,
    carbUnit: input.carbUnit,
    carbDuration: input.carbDuration,
  });
  await BatchRepository.attachSession(batch.id, session.id);
  await DeviceRepository.updateDeviceSessionCount(device.id, device.sessionCount + 1);

  return { ok: true, sessionId: session.id, recipeName: recipe.name };
}

// Cancels a queued brew that hasn't been picked up yet. Refuses once the device has started it —
// from then on it's a real brew and is ended from the session page instead.
export async function cancelQueuedBrew(sessionId: number): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await SessionRepository.getSessionById(sessionId);
  if (!session) {
    return { ok: true };
  }
  if (session.statusText !== QUEUED_STATUS_TEXT) {
    return { ok: false, error: 'This brew has already been started on the device' };
  }
  await deleteQueuedSession(session);
  return { ok: true };
}

// Where a queued brew stands, for the New Session page's waiting screen.
export async function getQueuedBrewStatus(deviceId: number, sessionId: number): Promise<'waiting' | 'picked' | 'gone'> {
  const session = await SessionRepository.getSessionById(sessionId);
  if (!session || session.deviceId !== deviceId || session.state === SessionState.CANCELED) {
    return 'gone';
  }
  if (session.statusText === QUEUED_STATUS_TEXT) {
    const stillQueued = await SessionRepository.findQueuedBrew(deviceId);
    return stillQueued?.id === session.id ? 'waiting' : 'gone';
  }
  return 'picked';
}

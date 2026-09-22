import type { LoaderFunctionArgs } from 'react-router';
import { picoResponse } from '~/utils/pico-response.server';
import { z } from 'zod';
import { DeviceRepository } from '~/repositories/device.server';
import { SessionRepository } from '~/repositories/session.server';
import { SessionType, SessionState, DeviceLogType } from '~/types';
import { randomUUID } from '~/utils/encryption';

const bodyValidator = z.object({
  uid: z.string(),
  sesType: z.preprocess((value) => Number.parseInt(`${value}`), z.nativeEnum(SessionType)),
});

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const body = bodyValidator.safeParse(Object.fromEntries(new URL(request.url).searchParams.entries()));
  if (!body.success) {
    throw new Response(`Action payload error: ${JSON.stringify(body.error.flatten().fieldErrors)}`, { status: 400 });
  }

  // get device if it exists
  const device = await DeviceRepository.getDeviceByUID(body.data.uid);
  if (!device) {
    return picoResponse(`##\r\n`);
  }
  await DeviceRepository.touchLastSeen(device.id);

  if (body.data.sesType === SessionType.BREWING || body.data.sesType > SessionType.MANUAL_BREW) {
    return picoResponse(`##\r\n`);
  }

  // Close out anything this device left dangling (e.g. a deep clean that never got a "complete"
  // log line) so it doesn't stay stuck IN_PROGRESS/READY forever once this new one starts.
  const priorSession = await SessionRepository.getLastActiveSessionByDeviceId(device.id);
  if (priorSession && priorSession.state !== SessionState.COMPLETED && priorSession.state !== SessionState.CANCELED) {
    await SessionRepository.cancelSession(priorSession.id);
  }

  // Every call needs its own fresh session id — unlike getRecipe's brewing sessions (keyed by the
  // PicoPak's own RFID, so re-polling finds the same row), this endpoint's device+type request has
  // no per-session identifier to key on, so the device's uid must never be reused as the session's.
  // The reference server (chiefwigms/picobrew_pico) sends exactly 20 hex characters here — the
  // firmware's session-id buffer is sized for that, so a longer id can corrupt its parsing.
  const session = await SessionRepository.createSession(
    randomUUID().replace(/-/g, '').slice(0, 20),
    body.data.sesType,
    device.id,
  );

  // log device session creation event
  await DeviceRepository.createDeviceLog(device.id, {
    type: DeviceLogType.SESSION_CREATED,
    sesType: body.data.sesType,
  });

  if (body.data.sesType === SessionType.DEEP_CLEAN) {
    // update the last deep clean based on session count
    await DeviceRepository.updateDeviceDeepCleanSession(device.id, device.sessionCount);
  } else {
    // record the session creation on the device
    await DeviceRepository.updateDeviceSessionCount(device.id, device.sessionCount + 1);
  }

  // Return the actual session UID (not a random hash)
  return picoResponse(`#${session.uid}#\r\n`);
};

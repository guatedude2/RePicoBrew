import type { LoaderFunctionArgs } from 'react-router';
import { picoResponse } from '~/utils/pico-response.server';
import { z } from 'zod';
import { DeviceRepository } from '~/repositories/device.server';
import { SessionRepository } from '~/repositories/session.server';
import { isPicoFermSessionExpired } from '~/services/picoferm.server';
import { SessionState } from '~/types';

/**
 * GET /API/PicoFerm/getState?uid={uid}
 *
 * Response: '#10,0#' if a fermentation-tracking session is active for this device (keep sending),
 * else '#2,4#' (uninitialized / no active session — stop sending).
 */
const bodyValidator = z.object({
  uid: z.string(),
});

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const body = bodyValidator.safeParse(Object.fromEntries(new URL(request.url).searchParams.entries()));
  if (!body.success) {
    throw new Response(`Action payload error: ${JSON.stringify(body.error.flatten().fieldErrors)}`, { status: 400 });
  }

  const device = await DeviceRepository.getDeviceByUID(body.data.uid);
  if (!device) {
    return picoResponse('#2,4#');
  }
  await DeviceRepository.touchLastSeen(device.id);

  const session = await SessionRepository.getLastActiveSessionByDeviceId(device.id);
  const isActive = !!session && session.state === SessionState.IN_PROGRESS && !isPicoFermSessionExpired(session);

  return picoResponse(isActive ? '#10,0#' : '#2,4#');
};

import type { LoaderFunctionArgs } from 'react-router';
import { z } from 'zod';
import { DeviceRepository } from '~/repositories/device.server';
import { SessionRepository } from '~/repositories/session.server';
import { describePicoErrorCode } from '~/utils/pico-error-codes';
import { DeviceLogType } from '~/types';
import pubSub from '~/services/pubsub.server';

const bodyValidator = z.object({
  uid: z.string(),
  code: z.preprocess((value) => Number.parseInt(`${value}`), z.number()),
  rfid: z.string().optional(),
});

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const body = bodyValidator.safeParse(Object.fromEntries(new URL(request.url).searchParams.entries()));
  if (!body.success) {
    throw new Response(`Action payload error: ${JSON.stringify(body.error.flatten().fieldErrors)}`, { status: 400 });
  }

  // get device if it exists
  const device = await DeviceRepository.getDeviceByUID(body.data.uid);
  if (!device) {
    return new Response(`\r\n`);
  }
  await DeviceRepository.touchLastSeen(device.id);

  // log device error code
  await DeviceRepository.createDeviceLog(device.id, {
    type: DeviceLogType.ERROR,
    errorCode: body.data.code,
    sessionUID: body.data.rfid,
  });

  // Surface it live to anyone watching the session (or the dashboard), instead of it only
  // showing up on the next full page load.
  const session = body.data.rfid ? await SessionRepository.getSession(body.data.rfid) : null;
  pubSub.publish('session-error', {
    deviceId: device.id,
    sessionId: session?.id ?? null,
    code: body.data.code,
    ...describePicoErrorCode(body.data.code),
  });

  return new Response(`\r\n`);
};

import type { LoaderArgs } from '@remix-run/node';
import { z } from 'zod';
import { DeviceLogType, DeviceRepository } from '~/repositories/device.server';
import { SessionRepository, SessionType } from '~/repositories/session.server';
import { md5 } from '~/utils/encryption';

const bodyValidator = z.object({
  uid: z.string(),
  sesType: z.preprocess((value) => Number.parseInt(`${value}`), z.nativeEnum(SessionType)),
});

export const loader = async ({ request }: LoaderArgs) => {
  const body = bodyValidator.safeParse(Object.fromEntries(new URL(request.url).searchParams.entries()));
  if (!body.success) {
    throw new Response(`Action payload error: ${JSON.stringify(body.error.flatten().fieldErrors)}`, { status: 400 });
  }

  // get device if it exists
  const device = await DeviceRepository.getDeviceByUID(body.data.uid);
  if (!device) {
    return new Response(`##\r\n`);
  }

  if (body.data.sesType === SessionType.BREWING || body.data.sesType > SessionType.MANUAL_BREW) {
    return new Response(`##\r\n`);
  }

  // create a session
  await SessionRepository.createSession(body.data.uid, body.data.sesType, device.id);

  // log device session creation event
  await DeviceRepository.createDeviceLog(device.id, {
    type: DeviceLogType.SESSION_CREATED,
    sesType: body.data.sesType,
  });

  if (body.data.sesType === SessionType.DEEP_CLEAN) {
    // update the last deep clean based on session countc
    await DeviceRepository.updateDeviceDeepCleanSession(device.id, device.sessionCount);
  } else {
    // record the session creation on the device
    await DeviceRepository.updateDeviceSessionCount(device.id, device.sessionCount + 1);
  }

  // generates a unique id
  return new Response(`#${md5(`${Math.random()}`).substring(0, 20)}#\r\n`);
};

import type { LoaderArgs } from '@remix-run/node';
import { getClientIPAddress } from 'remix-utils';
import { z } from 'zod';
import { DeviceLogType, DeviceRepository, DeviceType } from '~/repositories/device.server';
import pubsub from '~/services/pubsub.server';

const bodyValidator = z.object({
  uid: z.string(),
});

export const loader = async ({ request }: LoaderArgs) => {
  const body = bodyValidator.safeParse(Object.fromEntries(new URL(request.url).searchParams.entries()));
  if (!body.success) {
    throw new Response(`Action payload error: ${JSON.stringify(body.error.flatten().fieldErrors)}`, { status: 400 });
  }

  // get the client IP address from headers
  const deviceIP = getClientIPAddress(request);

  // get device if it exists
  const device = await DeviceRepository.getDeviceByUID(body.data.uid);
  const isRegistered = Boolean(device);

  if (device) {
    // update the device IP address
    await DeviceRepository.updateDeviceIPAddress(device.id, deviceIP);

    // log device register event
    await DeviceRepository.createDeviceLog(device.id, { type: DeviceLogType.REGISTER, ip: deviceIP });
  }

  // publish existing device detected event
  pubsub.publish('device-detected', { uid: body.data.uid, type: DeviceType.PICOBREW_C, isRegistered });

  return new Response(`#${isRegistered ? 'T' : 'F'}#\r\n`);
};

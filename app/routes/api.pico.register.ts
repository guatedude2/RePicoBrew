import type { LoaderFunctionArgs } from 'react-router';
import { getClientIPAddress } from 'remix-utils/get-client-ip-address';
import { z } from 'zod';
import { DeviceRepository } from '~/repositories/device.server';
import pubsub from '~/services/pubsub.server';
import { DeviceLogType } from '~/types';

const bodyValidator = z.object({
  uid: z.string(),
});

export const loader = async ({ request }: LoaderFunctionArgs) => {
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
    await DeviceRepository.touchLastSeen(device.id);

    // log device register event
    await DeviceRepository.createDeviceLog(device.id, { type: DeviceLogType.REGISTER, ip: deviceIP });
  } else {
    // Pico S/C/Pro all hit this same endpoint, so the model is ambiguous until claimed —
    // record the sighting so it shows up in the Devices page's Discovered list.
    await DeviceRepository.upsertDiscoveredDevice(body.data.uid, null, { ipAddress: deviceIP });
  }

  // publish existing device detected event
  pubsub.publish('device-detected', { uid: body.data.uid, deviceType: null, isRegistered });

  return new Response(`#${isRegistered ? 'T' : 'F'}#\r\n`);
};

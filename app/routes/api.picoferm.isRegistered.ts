import type { LoaderFunctionArgs } from 'react-router';
import { picoResponse } from '~/utils/pico-response.server';
import { z } from 'zod';
import { DeviceRepository } from '~/repositories/device.server';
import pubsub from '~/services/pubsub.server';
import { DeviceType } from '~/types';

/**
 * GET /API/PicoFerm/isRegistered?uid={uid}&token={token}
 *
 * PicoFerm registration is passive/automatic — there's no separate register call carrying
 * metadata, unlike PicoBrew C. The first time we see its uid it's recorded as a Discovered
 * device (not a claimed one) until an admin pairs it from Settings > Devices.
 * `token` is accepted (per the real firmware wire format) but not validated, matching the
 * reference server.
 *
 * Response: '#1#' always.
 */
const bodyValidator = z.object({
  uid: z.string(),
  token: z.string(),
});

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const body = bodyValidator.safeParse(Object.fromEntries(new URL(request.url).searchParams.entries()));
  if (!body.success) {
    throw new Response(`Action payload error: ${JSON.stringify(body.error.flatten().fieldErrors)}`, { status: 400 });
  }

  const device = await DeviceRepository.getDeviceByUID(body.data.uid);
  if (!device) {
    await DeviceRepository.upsertDiscoveredDevice(body.data.uid, DeviceType.PICOFERM);
    pubsub.publish('device-detected', { uid: body.data.uid, deviceType: DeviceType.PICOFERM, isRegistered: false });
  } else {
    await DeviceRepository.touchLastSeen(device.id);
  }

  return picoResponse('#1#');
};

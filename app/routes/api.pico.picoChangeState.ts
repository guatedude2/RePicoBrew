import type { LoaderFunctionArgs } from 'react-router';
import { z } from 'zod';
import { DeviceRepository } from '~/repositories/device.server';
import pubsub from '~/services/pubsub.server';
import { DeviceLogType, DeviceState } from '~/types';

const bodyValidator = z.object({
  picoUID: z.string(),
  state: z.preprocess((value) => Number.parseInt(`${value}`), z.nativeEnum(DeviceState)),
});

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const body = bodyValidator.safeParse(Object.fromEntries(new URL(request.url).searchParams.entries()));
  if (!body.success) {
    throw new Response(`Action payload error: ${JSON.stringify(body.error.flatten().fieldErrors)}`, { status: 400 });
  }

  // get device if it exists
  const device = await DeviceRepository.getDeviceByUID(body.data.picoUID);
  if (!device) {
    // ignore command if not registered
    return new Response(`#F#\r\n`);
  }

  // update the state of the device
  await DeviceRepository.updateDeviceState(device.id, body.data.state);

  // log device state change event
  await DeviceRepository.createDeviceLog(device.id, { type: DeviceLogType.STATE_CHANGE, state: body.data.state });

  // publish a state update of the device
  pubsub.publish('device-state-update', { uid: device.uid, state: body.data.state });

  return new Response(`\r\n`);
};

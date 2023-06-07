import type { LoaderArgs } from '@remix-run/node';
import { z } from 'zod';
import { DeviceLogType, DeviceRepository } from '~/repositories/device.server';

const bodyValidator = z.object({
  uid: z.string(),
  code: z.preprocess((value) => Number.parseInt(`${value}`), z.number()),
  rfid: z.string().optional(),
});

export const loader = async ({ request }: LoaderArgs) => {
  const body = bodyValidator.safeParse(Object.fromEntries(new URL(request.url).searchParams.entries()));
  if (!body.success) {
    throw new Response(`Action payload error: ${JSON.stringify(body.error.flatten().fieldErrors)}`, { status: 400 });
  }

  // get device if it exists
  const device = await DeviceRepository.getDeviceByUID(body.data.uid);
  if (!device) {
    return new Response(`\r\n`);
  }

  // log device error code
  await DeviceRepository.createDeviceLog(device.id, {
    type: DeviceLogType.ERROR,
    errorCode: body.data.code,
    sessionUID: body.data.rfid,
  });

  return new Response(`\r\n`);
};

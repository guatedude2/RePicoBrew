import type { LoaderFunctionArgs } from 'react-router';
import { z } from 'zod';
import { DeviceRepository } from '~/repositories/device.server';
import { DeviceLogType } from '~/types';

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

  // log device error code
  await DeviceRepository.createDeviceLog(device.id, {
    type: DeviceLogType.ERROR,
    errorCode: body.data.code,
    sessionUID: body.data.rfid,
  });

  return new Response(`\r\n`);
};

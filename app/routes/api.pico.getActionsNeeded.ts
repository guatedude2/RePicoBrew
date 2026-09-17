import type { LoaderFunctionArgs } from 'react-router';
import { z } from 'zod';
import { ConfigRepository } from '~/repositories/config.server';
import { DeviceRepository } from '~/repositories/device.server';
import type { DeviceType } from '~/types';
import { DeviceLogType } from '~/types';

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
    return new Response(`##\r\n`);
  }

  // get max sessions to deep clean from config based on this device's own registered type
  const maxSessions = await ConfigRepository.getDeviceSessionsToDeepClean(device.deviceType as DeviceType);
  const lastDeepClean = device.lastDeepCleanSession ?? 0;

  // check if cleaning is needed
  const needsCleaning = maxSessions ? device.sessionCount >= lastDeepClean + maxSessions : false;
  if (!needsCleaning || !maxSessions) {
    return new Response(`##\r\n`);
  }

  // log device deep clean warning
  await DeviceRepository.createDeviceLog(device.id, {
    type: DeviceLogType.DEEP_CLEAN_WARNING,
    sesOverCount: device.sessionCount - (lastDeepClean + maxSessions),
  });

  return new Response(`#7#\r\n`);
};

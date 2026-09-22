import type { LoaderFunctionArgs } from 'react-router';
import { picoResponse } from '~/utils/pico-response.server';
import fs from 'fs/promises';
import path from 'path';
import SemVer from 'semver';
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
    return picoResponse(`#F#\r\n`);
  }
  await DeviceRepository.touchLastSeen(device.id);

  // get the device firmware for this device's own registered model
  const firmware = await ConfigRepository.getDeviceFirmware(device.deviceType as DeviceType);
  // compare version with the device's current firmware
  const hadUpdate = Boolean(firmware && device.firmwareVersion && SemVer.lt(device.firmwareVersion, firmware.version));

  if (!firmware || !hadUpdate) {
    return picoResponse(`#F#\r\n`);
  }

  // log device firmware update event
  await DeviceRepository.createDeviceLog(device.id, {
    type: DeviceLogType.FIRMWARE_UPDATED,
    from: device.firmwareVersion,
    to: firmware.version,
  });

  // send over the raw file contents
  const rawContents = await fs.readFile(path.join(process.cwd(), firmware.file), 'utf8');
  return picoResponse(rawContents);
};

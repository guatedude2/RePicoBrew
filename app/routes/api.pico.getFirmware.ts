import type { LoaderArgs } from '@remix-run/node';
import fs from 'fs/promises';
import path from 'path';
import SemVer from 'semver';
import { z } from 'zod';
import { ConfigRepository } from '~/repositories/config.server';
import { DeviceRepository, DeviceType } from '~/repositories/device.server';

const bodyValidator = z.object({
  uid: z.string(),
});

export const loader = async ({ request }: LoaderArgs) => {
  const body = bodyValidator.safeParse(Object.fromEntries(new URL(request.url).searchParams.entries()));
  if (!body.success) {
    throw new Response(`Action payload error: ${JSON.stringify(body.error.flatten().fieldErrors)}`, { status: 400 });
  }

  const device = await DeviceRepository.getDeviceByUID(body.data.uid);
  if (!device) {
    return new Response(`#F#\r\n`);
  }

  // get the device firmware
  const firmware = await ConfigRepository.getDeviceFirmware(DeviceType.PICOBREW_C);
  // compare version with pico brew c version
  const hadUpdate = Boolean(firmware && device.firmwareVersion && SemVer.lt(device.firmwareVersion, firmware.version));

  if (!firmware || !hadUpdate) {
    return new Response(`#F#\r\n`);
  }

  // send over the raw file contents
  const rawContents = await fs.readFile(path.join(process.cwd(), firmware.file), 'utf8');
  return new Response(rawContents);
};

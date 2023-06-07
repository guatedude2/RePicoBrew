import type { LoaderArgs } from '@remix-run/node';
import SemVer from 'semver';
import { z } from 'zod';
import { ConfigRepository } from '~/repositories/config.server';
import { DeviceRepository, DeviceType } from '~/repositories/device.server';
import pubsub from '~/services/pubsub.server';

const bodyValidator = z.object({
  uid: z.string(),
  version: z.string(),
});

export const loader = async ({ request }: LoaderArgs) => {
  const body = bodyValidator.safeParse(Object.fromEntries(new URL(request.url).searchParams.entries()));
  if (!body.success) {
    throw new Response(`Action payload error: ${JSON.stringify(body.error.flatten().fieldErrors)}`, { status: 400 });
  }

  // get the device firmware
  const firmware = await ConfigRepository.getDeviceFirmware(DeviceType.PICOBREW_C);

  // compare version with pico brew c version
  const hadUpdate = Boolean(firmware && SemVer.lt(body.data.version, firmware.version));

  const device = await DeviceRepository.getDeviceByUID(body.data.uid);
  if (device) {
    // update the firmware version
    await DeviceRepository.updateDeviceFirmwareVersion(device.id, body.data.version);
    // if device registered, publish the firmware version to UI
    pubsub.publish('device-firmware', { uid: body.data.uid, firmwareVersion: body.data.version, hadUpdate });
  }

  return new Response(`#${hadUpdate ? 'T' : 'F'}#\r\n`);
};

import type { LoaderArgs } from '@remix-run/node';
import SemVer from 'semver';
import { z } from 'zod';
import { ConfigRepository } from '~/repositories/config.server';
import { DeviceRepository } from '~/repositories/device.server';
import pubsub from '~/services/pubsub.server';
import { DeviceLogType, DeviceType } from '~/types';

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

  const device = await DeviceRepository.getDeviceByUID(body.data.uid);
  if (!device || !firmware) {
    return new Response(`#F#\r\n`);
  }

  // compare version with pico brew c version
  const hasUpdate = Boolean(SemVer.lt(body.data.version, firmware.version));

  // update the actual firmware version
  await DeviceRepository.updateDeviceFirmwareVersion(device.id, body.data.version);

  if (hasUpdate) {
    // log device firmware update warning
    await DeviceRepository.createDeviceLog(device.id, {
      type: DeviceLogType.FIRMWARE_UPDATE_WARNING,
      current: body.data.version,
      to: firmware.version,
    });

    // if device registered, publish the firmware version to UI
    pubsub.publish('device-firmware', { uid: body.data.uid, firmwareVersion: body.data.version });
  }

  return new Response(`#${hasUpdate ? 'T' : 'F'}#\r\n`);
};

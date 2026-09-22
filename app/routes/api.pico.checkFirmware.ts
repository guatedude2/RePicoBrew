import type { LoaderFunctionArgs } from 'react-router';
import { picoResponse } from '~/utils/pico-response.server';
import SemVer from 'semver';
import { z } from 'zod';
import { ConfigRepository } from '~/repositories/config.server';
import { DeviceRepository } from '~/repositories/device.server';
import pubsub from '~/services/pubsub.server';
import type { DeviceType } from '~/types';
import { DeviceLogType } from '~/types';

const bodyValidator = z.object({
  uid: z.string(),
  version: z.string(),
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
  if (!firmware) {
    return picoResponse(`#F#\r\n`);
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

  return picoResponse(`#${hasUpdate ? 'T' : 'F'}#\r\n`);
};

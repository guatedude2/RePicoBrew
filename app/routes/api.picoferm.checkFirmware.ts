import type { LoaderFunctionArgs } from 'react-router';
import SemVer from 'semver';
import { z } from 'zod';
import { ConfigRepository } from '~/repositories/config.server';
import { DeviceRepository } from '~/repositories/device.server';
import pubsub from '~/services/pubsub.server';
import { DeviceLogType, DeviceType } from '~/types';

/**
 * GET /API/PicoFerm/checkFirmware?uid={uid}&version={version}
 *
 * Response: '#1#' if an update is available, else '#0#'.
 */
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
    return new Response('#0#');
  }
  await DeviceRepository.touchLastSeen(device.id);

  // No firmware config for PICOFERM is fine — just means no update available.
  const firmware = await ConfigRepository.getDeviceFirmware(DeviceType.PICOFERM);
  if (!firmware) {
    return new Response('#0#');
  }

  const hasUpdate = Boolean(SemVer.lt(body.data.version, firmware.version));

  await DeviceRepository.updateDeviceFirmwareVersion(device.id, body.data.version);

  if (hasUpdate) {
    await DeviceRepository.createDeviceLog(device.id, {
      type: DeviceLogType.FIRMWARE_UPDATE_WARNING,
      current: body.data.version,
      to: firmware.version,
    });

    pubsub.publish('device-firmware', { uid: body.data.uid, firmwareVersion: body.data.version });
  }

  return new Response(`#${hasUpdate ? '1' : '0'}#`);
};

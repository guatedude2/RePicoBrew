import type { LoaderArgs } from '@remix-run/node';
import fs from 'fs/promises';
import path from 'path';
import { ConfigRepository } from '~/repositories/config.server';
import { DeviceType } from '~/types';

/**
 * GET /firmware/picoferm/:file
 *
 * The actual file fetch half of PicoFerm's two-step firmware handoff — see
 * app/routes/api.picoferm.getFirmwareAddress.ts, which hands the device this URL.
 *
 * Response: raw firmware file contents.
 */
export const loader = async ({ params }: LoaderArgs) => {
  const firmware = await ConfigRepository.getDeviceFirmware(DeviceType.PICOFERM);
  if (!firmware || path.basename(firmware.file) !== params.file) {
    throw new Response('Not found', { status: 404 });
  }

  const rawContents = await fs.readFile(path.join(process.cwd(), firmware.file), 'utf8');
  return new Response(rawContents);
};

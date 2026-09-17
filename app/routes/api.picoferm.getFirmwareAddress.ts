import type { LoaderFunctionArgs } from 'react-router';
import path from 'path';
import { z } from 'zod';
import { ConfigRepository } from '~/repositories/config.server';
import { DeviceType } from '~/types';

/**
 * GET /API/PicoFerm/getFirmwareAddress?uid={uid}
 *
 * Unlike PicoBrew C's getFirmware (which streams the raw file directly), PicoFerm's protocol is a
 * two-step handoff: this returns a URL, and the device separately fetches it (see
 * app/routes/firmware.picoferm.$file.ts).
 *
 * Response: '#http://<host>/firmware/picoferm/{filename}#'
 */
const bodyValidator = z.object({
  uid: z.string(),
});

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const body = bodyValidator.safeParse(Object.fromEntries(new URL(request.url).searchParams.entries()));
  if (!body.success) {
    throw new Response(`Action payload error: ${JSON.stringify(body.error.flatten().fieldErrors)}`, { status: 400 });
  }

  const firmware = await ConfigRepository.getDeviceFirmware(DeviceType.PICOFERM);
  if (!firmware) {
    return new Response('##');
  }

  const filename = path.basename(firmware.file);
  const origin = new URL(request.url).origin;
  return new Response(`#${origin}/firmware/picoferm/${filename}#`);
};

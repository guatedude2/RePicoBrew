import type { LoaderFunctionArgs } from 'react-router';
import { picoResponse } from '~/utils/pico-response.server';
import { z } from 'zod';
import { BatchRepository } from '~/repositories/batch.server';
import { DeviceRepository } from '~/repositories/device.server';
import { SessionRepository } from '~/repositories/session.server';
import { backfillPicoFermTimestamps, isPicoFermSessionExpired } from '~/services/picoferm.server';
import pubsub from '~/services/pubsub.server';
import { BatchPhase, DeviceType, SessionState } from '~/types';

/**
 * GET /API/PicoFerm/logDataSet?uid={uid}&rate={rate}&voltage={voltage}&data={data}
 *
 * `data` is a JSON array of {"s1": temp, "s2": pressure} points, sampled every `rate` minutes,
 * with no per-point timestamp — see backfillPicoFermTimestamps.
 *
 * Response: '#2,4#' if the session just ended (was active, now stopped/expired — archive/close),
 * else '#10,0#' (continue sending).
 */
const bodyValidator = z.object({
  uid: z.string(),
  rate: z.preprocess((v) => Number.parseFloat(`${v}`), z.number()),
  voltage: z.preprocess((v) => Number.parseFloat(`${v}`), z.number()),
  data: z.string(),
});

const pointsValidator = z.array(z.object({ s1: z.number(), s2: z.number() }));

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const body = bodyValidator.safeParse(Object.fromEntries(new URL(request.url).searchParams.entries()));
  if (!body.success) {
    throw new Response(`Action payload error: ${JSON.stringify(body.error.flatten().fieldErrors)}`, { status: 400 });
  }

  let points: z.infer<typeof pointsValidator>;
  try {
    points = pointsValidator.parse(JSON.parse(body.data.data));
  } catch {
    throw new Response('Invalid data payload', { status: 400 });
  }

  // PicoFerm registration is passive - if this uid somehow arrives unclaimed, just record the
  // sighting (no session is possible without a claimed Device) and tell it to stop for now.
  const device = await DeviceRepository.getDeviceByUID(body.data.uid);
  if (!device) {
    await DeviceRepository.upsertDiscoveredDevice(body.data.uid, DeviceType.PICOFERM);
    pubsub.publish('device-detected', { uid: body.data.uid, deviceType: DeviceType.PICOFERM, isRegistered: false });
    return picoResponse('#2,4#');
  }
  await DeviceRepository.touchLastSeen(device.id);

  const session = await SessionRepository.getLastActiveSessionByDeviceId(device.id);
  const isActive = !!session && session.state === SessionState.IN_PROGRESS;

  if (!session || !isActive) {
    // No active tracking session for this device - nothing to log, tell the device to stop.
    return picoResponse('#2,4#');
  }

  if (isPicoFermSessionExpired(session)) {
    // Known limitation (see picoferm.server.ts): approximate the reference's 14-day auto-end by
    // closing the session ourselves and reporting it the same way an externally-ended one would be.
    await SessionRepository.completeSession(session.id);
    if (session.batchId) {
      await BatchRepository.advancePhase(session.batchId, BatchPhase.FERMENTING, BatchPhase.BOTTLING);
    }
    return picoResponse('#2,4#');
  }

  const entries = backfillPicoFermTimestamps(points, body.data.rate);
  for (const entry of entries) {
    await SessionRepository.createSessionLogEntry(
      session.id,
      { time: entry.time, temp: entry.temp, pressure: entry.pressure, voltage: body.data.voltage },
      1, // type 1 = ferment log
    );
  }

  const latest = entries[entries.length - 1];
  pubsub.publish('picoferm-update', {
    sessionId: session.id,
    deviceId: device.id,
    uid: body.data.uid,
    voltage: body.data.voltage,
    temp: latest?.temp,
    pressure: latest?.pressure,
  });

  return picoResponse('#10,0#');
};

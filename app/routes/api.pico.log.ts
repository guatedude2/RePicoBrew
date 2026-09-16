import type { LoaderArgs } from '@remix-run/node';
import { z } from 'zod';
import { DeviceRepository } from '~/repositories/device.server';
import { SessionRepository, SessionState, SessionType } from '~/repositories/session.server';
import { pubSub } from '~/services/pubsub.server';
import { DeviceState } from '~/types';

const bodyValidator = z.object({
  uid: z.string(),
  sesId: z.string(),
  wort: z.preprocess((value) => Number.parseInt(`${value}`), z.number()),
  therm: z.preprocess((value) => Number.parseInt(`${value}`), z.number()),
  step: z.string(),
  event: z.string().optional(),
  error: z.preprocess((value) => Number.parseInt(`${value}`), z.number()),
  sesType: z.preprocess((value) => Number.parseInt(`${value}`), z.nativeEnum(SessionType)),
  timeLeft: z.preprocess((value) => Number.parseInt(`${value}`), z.number()),
  shutScale: z.preprocess((value) => Number.parseFloat(`${value}`), z.number()),
});

const getStateFromType = (type: SessionType) => {
  switch (type) {
    case SessionType.BREWING:
    case SessionType.COLD_BREW:
    case SessionType.MANUAL_BREW:
      return DeviceState.BREWING;
    case SessionType.DEEP_CLEAN:
      return DeviceState.DEEP_CLEAN;
    case SessionType.SOUS_VIDE:
      return DeviceState.SOUS_VIDE;
  }
};

export const loader = async ({ request }: LoaderArgs) => {
  const body = bodyValidator.safeParse(Object.fromEntries(new URL(request.url).searchParams.entries()));
  if (!body.success) {
    throw new Response(`Action payload error: ${JSON.stringify(body.error.flatten().fieldErrors)}`, { status: 400 });
  }

  // get the session details
  const session = await SessionRepository.getSession(body.data.sesId);
  if (!session) {
    return new Response(`\r\n`);
  }

  // Check if brew is complete (step contains "complete")
  const isComplete = body.data.step.toLowerCase().includes('complete');
  const sessionState = isComplete ? SessionState.COMPLETED : SessionState.IN_PROGRESS;

  // update device state
  if (isComplete) {
    await DeviceRepository.updateDeviceState(session.deviceId, DeviceState.READY);
  } else {
    await DeviceRepository.updateDeviceState(session.deviceId, getStateFromType(body.data.sesType));
  }

  // update the session status
  await SessionRepository.updateSessionState(
    session.id,
    body.data.sesType,
    sessionState,
    body.data.step,
    body.data.timeLeft,
  );

  // create a log entry
  await SessionRepository.createSessionLogEntry(session.id, {
    wort: body.data.wort,
    therm: body.data.therm,
    step: body.data.step,
    event: body.data.event,
    error: body.data.error,
    timeLeft: body.data.timeLeft,
    shutScale: body.data.shutScale,
  });

  // Publish session update event for live UI
  pubSub.publish('session-update', {
    sessionId: session.id,
    sessionUid: session.uid,
    deviceId: session.deviceId,
    state: sessionState,
    step: body.data.step,
    event: body.data.event,
    wort: body.data.wort,
    therm: body.data.therm,
    timeLeft: body.data.timeLeft,
    isComplete,
  });

  return new Response(`\r\n`);
};

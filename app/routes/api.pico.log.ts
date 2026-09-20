import type { LoaderFunctionArgs } from 'react-router';
import { z } from 'zod';
import { BatchRepository } from '~/repositories/batch.server';
import { DeviceRepository } from '~/repositories/device.server';
import { SessionRepository } from '~/repositories/session.server';
import { BatchPhase, SessionState, SessionType, DeviceState } from '~/types';
import pubSub from '~/services/pubsub.server';

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

const getStateFromType = (type: SessionType): DeviceState => {
  switch (type) {
    case SessionType.BREWING:
    case SessionType.COLD_BREW:
    case SessionType.MANUAL_BREW:
      return DeviceState.BREWING;
    case SessionType.DEEP_CLEAN:
      return DeviceState.DEEP_CLEAN;
    case SessionType.SOUS_VIDE:
      return DeviceState.SOUS_VIDE;
    case SessionType.FERMENTATION:
      return DeviceState.READY; // Fermentation doesn't change device state
    default:
      return DeviceState.READY;
  }
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
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
  // Canceling on the device sends a normal log line with the step "Brew Canceled" (then a
  // picoChangeState back to READY about a minute later) — that log is the only cancel signal.
  const isCanceled = !isComplete && body.data.step.toLowerCase().includes('cancel');
  let sessionState = SessionState.IN_PROGRESS;
  if (isComplete) {
    sessionState = SessionState.COMPLETED;
  } else if (isCanceled || session.state === SessionState.CANCELED) {
    sessionState = SessionState.CANCELED;
  }

  // update device state
  if (isComplete) {
    // The brew itself is done, so the batch moves straight into Cooling — but leaving Cooling for
    // Fermenting still needs the user to confirm the wort has cooled and yeast has been pitched
    // (see startFermentation intent), which is a manual, physical step the device can't detect.
    await DeviceRepository.updateDeviceState(session.deviceId, DeviceState.READY);
    if (session.batchId) {
      await BatchRepository.advancePhase(session.batchId, BatchPhase.BREWING, BatchPhase.COOLING);
    }
  } else if (sessionState === SessionState.CANCELED) {
    await DeviceRepository.updateDeviceState(session.deviceId, DeviceState.READY);
    if (isCanceled && session.batchId) {
      await BatchRepository.endBatch(session.batchId);
    }
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

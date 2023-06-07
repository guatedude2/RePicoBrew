import type { LoaderArgs } from '@remix-run/node';
import { z } from 'zod';
import { DeviceRepository, DeviceState } from '~/repositories/device.server';
import { SessionRepository, SessionState, SessionType } from '~/repositories/session.server';

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

  // update device state
  await DeviceRepository.updateDeviceState(session.deviceId, getStateFromType(body.data.sesType));

  // update the session status
  await SessionRepository.updateSessionState(
    session.id,
    body.data.sesType,
    SessionState.IN_PROGRESS,
    body.data.step,
    body.data.timeLeft,
  );

  // create a log entry
  await SessionRepository.createSessionLogEntry(session.id, {
    wort: body.data.wort,
    therm: body.data.therm,
    event: body.data.event,
    error: body.data.error,
    shutScale: body.data.shutScale,
  });

  return new Response(`\r\n`);
};

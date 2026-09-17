import type { ActionArgs, LoaderArgs } from '@remix-run/node';
import { json, redirect } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { BatchRepository } from '~/repositories/batch.server';
import { DeviceRepository } from '~/repositories/device.server';
import { SessionRepository } from '~/repositories/session.server';
import { DeviceType, SessionState, SessionType } from '~/types';
import { SessionDetail } from '~/pages/SessionDetail';

export const meta = () => [{ title: 'Session Detail | RePicoBrew' }];

export const loader = async ({ params }: LoaderArgs) => {
  const id = parseInt(params.id!);
  const session = await SessionRepository.getSessionById(id);
  if (!session) {
    throw new Response('Session not found', { status: 404 });
  }

  const batch = await BatchRepository.getOrCreateBatchForSession(id);
  if (!batch) {
    throw new Response('Session not found', { status: 404 });
  }

  const brewSession =
    batch.sessions.find(
      (s: { type: number }) => s.type === SessionType.BREWING || s.type === SessionType.MANUAL_BREW,
    ) ?? null;
  const fermSession = batch.sessions.find((s: { type: number }) => s.type === SessionType.FERMENTATION) ?? null;

  const [brewLogs, fermLogs, devices] = await Promise.all([
    brewSession ? SessionRepository.listSessionLogs(brewSession.id) : Promise.resolve([]),
    fermSession ? SessionRepository.listSessionLogs(fermSession.id) : Promise.resolve([]),
    DeviceRepository.listDevices(),
  ]);
  // Flag each Tilt as in-use (already tracking some other batch) or offline so the picker can
  // show why a device can't be selected instead of silently failing when Start Tracking is clicked.
  const tiltDevices = await Promise.all(
    devices
      .filter((d) => d.deviceType === DeviceType.TILT)
      .map(async (d) => {
        const activeSession = await SessionRepository.getLastActiveSessionByDeviceId(d.id);
        return {
          ...d,
          online: DeviceRepository.isDeviceOnline(d),
          inUse: activeSession?.state === SessionState.IN_PROGRESS,
        };
      }),
  );

  return json({ batch, brewSession, fermSession, brewLogs, fermLogs, tiltDevices });
};

export const action = async ({ request, params }: ActionArgs) => {
  const id = parseInt(params.id!);
  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'endSession') {
    const batch = await BatchRepository.getOrCreateBatchForSession(id);
    if (batch) {
      await BatchRepository.endBatch(batch.id);
    }
    return json({ success: true });
  }

  if (intent === 'deleteBatch') {
    const batch = await BatchRepository.getOrCreateBatchForSession(id);
    if (batch) {
      await BatchRepository.deleteBatch(batch.id);
    }
    return redirect('/sessions');
  }

  return json({ error: 'Unknown intent' }, { status: 400 });
};

export default function SessionDetailRoute() {
  const data = useLoaderData<typeof loader>();
  return <SessionDetail {...data} />;
}

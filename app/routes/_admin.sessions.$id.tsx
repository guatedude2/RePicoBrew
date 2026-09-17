import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { data, redirect } from 'react-router';
import { useLoaderData } from 'react-router';
import { AiAdviceRepository } from '~/repositories/ai-advice.server';
import { BatchRepository } from '~/repositories/batch.server';
import { DeviceRepository } from '~/repositories/device.server';
import { SessionRepository } from '~/repositories/session.server';
import { DeviceType, SessionState, SessionType } from '~/types';
import { SessionDetail } from '~/pages/SessionDetail';

export const meta = () => [{ title: 'Session Detail | RePicoBrew' }];

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const idParam = params.id;
  if (!idParam) {
    throw new Response('Session not found', { status: 404 });
  }
  const id = parseInt(idParam, 10);
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

  const [brewLogs, fermLogs, devices, aiAdvice] = await Promise.all([
    brewSession ? SessionRepository.listSessionLogs(brewSession.id) : Promise.resolve([]),
    fermSession ? SessionRepository.listSessionLogs(fermSession.id) : Promise.resolve([]),
    DeviceRepository.listDevices(),
    AiAdviceRepository.listForBatch(batch.id),
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

  return { batch, brewSession, fermSession, brewLogs, fermLogs, tiltDevices, aiAdvice };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const idParam = params.id;
  if (!idParam) {
    throw new Response('Session not found', { status: 404 });
  }
  const id = parseInt(idParam, 10);
  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'endSession') {
    const batch = await BatchRepository.getOrCreateBatchForSession(id);
    if (batch) {
      await BatchRepository.endBatch(batch.id);
    }
    return { success: true };
  }

  if (intent === 'deleteBatch') {
    const batch = await BatchRepository.getOrCreateBatchForSession(id);
    if (batch) {
      await BatchRepository.deleteBatch(batch.id);
    }
    return redirect('/sessions');
  }

  return data({ error: 'Unknown intent' }, { status: 400 });
};

export default function SessionDetailRoute() {
  const loaderData = useLoaderData<typeof loader>();
  return <SessionDetail {...loaderData} />;
}

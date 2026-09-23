import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { data, redirect, useLoaderData } from 'react-router';
import { AiAdviceRepository } from '~/repositories/ai-advice.server';
import { BatchRepository } from '~/repositories/batch.server';
import { DeviceRepository } from '~/repositories/device.server';
import { SessionRepository } from '~/repositories/session.server';
import { DeviceType, SessionState, SessionType } from '~/types';
import { describePicoErrorCode } from '~/utils/pico-error-codes';
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

  // The full log history is fetched client-side, thinned (see useSessionLogs); only the newest ferment reading is
  // needed up front, to seed the live signal display.
  const lastFermLog = fermSession ? await SessionRepository.getLatestSessionLog(fermSession.id) : null;

  const [devices, aiAdvice, brewDeviceErrors] = await Promise.all([
    DeviceRepository.listDevices(),
    AiAdviceRepository.listForBatch(batch.id),
    brewSession ? DeviceRepository.listErrorLogsForSession(brewSession.deviceId, brewSession.uid) : Promise.resolve([]),
  ]);
  const brewErrors = brewDeviceErrors.map((log) => ({
    time: log.time,
    code: log.data.errorCode,
    ...describePicoErrorCode(log.data.errorCode),
  }));
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

  return { batch, brewSession, fermSession, lastFermLog, tiltDevices, aiAdvice, brewErrors };
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
  return <SessionDetail {...useLoaderData<typeof loader>()} />;
}

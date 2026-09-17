import { json, type LoaderArgs, type SessionData } from '@remix-run/node';
import { MainLayout } from '~/layouts/MainLayout';
import { BatchRepository } from '~/repositories/batch.server';
import { DeviceRepository } from '~/repositories/device.server';
import authenticator from '~/services/auth.server';
import { ServerSideEventsProvider } from '~/utils/sse';

export const loader = async ({ request }: LoaderArgs) => {
  const session = (await authenticator.isAuthenticated(request, {
    failureRedirect: '/signin',
  })) as SessionData;

  const [deviceStatus, attentionBatches] = await Promise.all([
    DeviceRepository.getStatus(),
    BatchRepository.listNeedingAttention(),
  ]);

  return json({
    session,
    deviceStatus,
    attentionBatches: attentionBatches.map((batch) => ({
      id: batch.id,
      name: batch.name,
      phase: batch.phase,
      sessionId: batch.sessions[0]?.id ?? null,
    })),
  });
};

export default () => (
  <ServerSideEventsProvider url="/api/events">
    <MainLayout />
  </ServerSideEventsProvider>
);

import type { LoaderFunctionArgs } from 'react-router';
import { redirect } from 'react-router';
import { MainLayout } from '~/layouts/MainLayout';
import { AiSettingsRepository } from '~/repositories/ai-settings.server';
import { BatchRepository } from '~/repositories/batch.server';
import { DeviceRepository } from '~/repositories/device.server';
import { UserRepository } from '~/repositories/user.server';
import authenticator from '~/services/auth.server';
import type { SessionData } from '~/services/session.server';
import { ServerSideEventsProvider } from '~/utils/sse';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // A fresh install/disk image has no users yet — send it through first-time setup instead of
  // sign-in, since there's no account to sign in with.
  if ((await UserRepository.count()) === 0) {
    throw redirect('/setup');
  }

  const session = (await authenticator.isAuthenticated(request, {
    failureRedirect: '/signin',
  })) as SessionData;

  // Dynamic + server-only: a static top-level import here would get pulled into the client
  // bundle too (this route's default export is rendered client-side), but this module reaches
  // into Prisma/repositories that can only run on the server. A dynamic import inside the loader
  // is stripped from the client bundle like the rest of this function; the module-level
  // `global.__aiSchedulerStarted` guard in ai-scheduler.server.ts still only starts the interval once.
  void import('~/services/ai-scheduler.server');

  const [deviceStatus, attentionBatches, hasAiKey] = await Promise.all([
    DeviceRepository.getStatus(),
    BatchRepository.listNeedingAttention(),
    AiSettingsRepository.hasActiveKey(),
  ]);

  return {
    session,
    deviceStatus,
    hasAiKey,
    attentionBatches: attentionBatches.map((batch) => ({
      id: batch.id,
      name: batch.name,
      phase: batch.phase,
      sessionId: batch.sessions[0]?.id ?? null,
      updatedAt: batch.updatedAt,
    })),
  };
};

export default () => (
  <ServerSideEventsProvider url="/api/events">
    <MainLayout />
  </ServerSideEventsProvider>
);

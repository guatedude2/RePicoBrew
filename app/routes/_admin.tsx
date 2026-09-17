import { json, type LoaderArgs, type SessionData } from '@remix-run/node';
import { MainLayout } from '~/layouts/MainLayout';
import { DeviceRepository } from '~/repositories/device.server';
import authenticator from '~/services/auth.server';
import { ServerSideEventsProvider } from '~/utils/sse';

export const loader = async ({ request }: LoaderArgs) => {
  const session = (await authenticator.isAuthenticated(request, {
    failureRedirect: '/signin',
  })) as SessionData;

  const deviceStatus = await DeviceRepository.getStatus();

  return json({ session, deviceStatus });
};

export default () => (
  <ServerSideEventsProvider url="/api/events">
    <MainLayout />
  </ServerSideEventsProvider>
);

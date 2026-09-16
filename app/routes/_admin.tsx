import { json, type LoaderArgs, type SessionData } from '@remix-run/node';
import { MainLayout } from '~/layouts/MainLayout';
import authenticator from '~/services/auth.server';
import { ServerSideEventsProvider } from '~/utils/sse';

export const loader = async ({ request }: LoaderArgs) => {
  const url = new URL(request.url);
  if (url.pathname.startsWith('/signin')) {
    return json({});
  }

  const session = (await authenticator.isAuthenticated(request, {
    failureRedirect: '/signin',
  })) as SessionData;
  return json({ session });
};

export default () => (
  <ServerSideEventsProvider url="/api/events">
    <MainLayout />
  </ServerSideEventsProvider>
);

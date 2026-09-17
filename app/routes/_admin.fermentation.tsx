import type { LoaderFunctionArgs } from 'react-router';
import { useLoaderData } from 'react-router';
import Dashboard from '~/pages/Fermentation';
import { SessionRepository } from '~/repositories/session.server';
import { serializeDates } from '~/utils/serialize.server';

export async function loader(_args: LoaderFunctionArgs) {
  const sessions = await SessionRepository.listActiveSessions();
  const fermentationSessions = sessions.filter((s) => s.type === 3); // FERMENTATION = 3

  return serializeDates({ sessions: fermentationSessions });
}

export default function FermentationRoute() {
  const { sessions } = useLoaderData<typeof loader>();
  return <Dashboard sessions={sessions} />;
}

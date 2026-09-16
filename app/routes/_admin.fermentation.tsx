import type { LoaderArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import Dashboard from '~/pages/Fermentation';
import { SessionRepository } from '~/repositories/session.server';

export async function loader(_args: LoaderArgs) {
  const sessions = await SessionRepository.listActiveSessions();
  const fermentationSessions = sessions.filter((s) => s.type === 3); // FERMENTATION = 3

  return json({ sessions: fermentationSessions });
}

export default function FermentationRoute() {
  const { sessions } = useLoaderData<typeof loader>();
  return <Dashboard sessions={sessions} />;
}

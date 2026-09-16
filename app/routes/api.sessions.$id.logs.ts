import type { LoaderArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { SessionRepository } from '~/repositories/session.server';

export async function loader({ params }: LoaderArgs) {
  const sessionId = parseInt(params.id || '0');
  if (!sessionId) {
    return json({ error: 'Invalid session ID' }, { status: 400 });
  }

  const logs = await SessionRepository.listSessionLogs(sessionId);
  return json(logs);
}

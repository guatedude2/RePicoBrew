import type { LoaderFunctionArgs } from 'react-router';
import { data } from 'react-router';
import { SessionRepository } from '~/repositories/session.server';

export async function loader({ params }: LoaderFunctionArgs) {
  const sessionId = parseInt(params.id || '0');
  if (!sessionId) {
    return data({ error: 'Invalid session ID' }, { status: 400 });
  }

  const logs = await SessionRepository.listSessionLogs(sessionId);
  return logs;
}

import type { LoaderArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { SessionRepository } from '~/repositories/session.server';

export const meta = () => [{ title: 'Dashboard | RePicoBrew' }, { name: 'description', content: 'Live brew tracking' }];

export const loader = async (_args: LoaderArgs) => {
  const activeSessions = await SessionRepository.listActiveSessions();
  return json({ activeSessions });
};

export { Dashboard as default } from '~/pages/Dashboard';

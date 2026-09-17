import type { ActionArgs } from '@remix-run/node';
import { redirect } from '@remix-run/node';
import { sessionStorage } from '~/services/session.server';

export const action = async ({ request }: ActionArgs) => {
  const session = await sessionStorage.getSession(request.headers.get('cookie'));
  return redirect('/signin', {
    headers: { 'Set-Cookie': await sessionStorage.destroySession(session) },
  });
};

export const loader = async () => redirect('/signin');

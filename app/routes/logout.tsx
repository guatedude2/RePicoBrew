import type { ActionFunctionArgs } from 'react-router';
import { redirect } from 'react-router';
import { sessionStorage } from '~/services/session.server';

export const action = async ({ request }: ActionFunctionArgs) => {
  const session = await sessionStorage.getSession(request.headers.get('cookie'));
  return redirect('/signin', {
    headers: { 'Set-Cookie': await sessionStorage.destroySession(session) },
  });
};

export const loader = async () => redirect('/signin');

import type { ActionFunctionArgs } from 'react-router';
import { redirect } from 'react-router';
import { z } from 'zod';
import { UserRepository } from '~/repositories/user.server';
import { authenticateUser, sessionKey } from '~/services/auth.server';
import { rememberMeCookie, sessionStorage } from '~/services/session.server';

const bodyValidator = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const loader = async () => {
  // No accounts yet means this is a fresh install — there's nothing to sign in with.
  if ((await UserRepository.count()) === 0) {
    throw redirect('/setup');
  }
  return null;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const url = new URL(request.url);
  const redirectTo = url.searchParams.get('redir') ?? '/';
  const formData = await request.formData();

  const body = bodyValidator.safeParse(Object.fromEntries(formData));
  if (!body.success) {
    return { error: { ...body.error.flatten().fieldErrors } };
  }

  try {
    const user = await authenticateUser(body.data.email, body.data.password);
    const remember = formData.get('remember') === 'on';

    const cookieHeader = request.headers.get('cookie');
    const session = await sessionStorage.getSession(cookieHeader);

    // and store the user data
    session.set(sessionKey, user);

    // commit the session
    const headers = new Headers({ 'Set-Cookie': await sessionStorage.commitSession(session) });

    // commit remember me
    headers.append('Set-Cookie', await rememberMeCookie.serialize(remember ? user.email : null));

    return redirect(redirectTo, { headers });
  } catch (error) {
    return { error: { message: (error as Error).message } };
  }
};

export { SignIn as default } from '~/pages/SignIn';

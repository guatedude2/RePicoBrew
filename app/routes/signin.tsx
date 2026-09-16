import type { ActionArgs } from '@remix-run/node';
import { json, redirect } from '@remix-run/node';
import { z } from 'zod';
import authenticator from '~/services/auth.server';
import type { SessionData } from '~/services/session.server';
import { rememberMeCookie, sessionStorage } from '~/services/session.server';

const bodyValidator = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const action = async ({ request }: ActionArgs) => {
  const url = new URL(request.url);
  const redirectTo = url.searchParams.get('redir') ?? '/';
  const formData = await request.formData();

  const body = bodyValidator.safeParse(Object.fromEntries(formData));
  if (!body.success) {
    return json({ error: { ...body.error.flatten().fieldErrors } });
  }

  try {
    const data = await authenticator.authenticate('user', request, { throwOnError: true, context: { formData } });

    const cookieHeader = request.headers.get('cookie');
    const session = await sessionStorage.getSession(cookieHeader);
    const { remember, ...user } = data as SessionData & { remember: boolean };

    // and store the user data
    session.set(authenticator.sessionKey, user);

    // // commit the session
    const headers = new Headers({ 'Set-Cookie': await sessionStorage.commitSession(session) });

    // commit remember me
    headers.append('Set-Cookie', await rememberMeCookie.serialize(remember ? user.email : null));

    return redirect(redirectTo, { headers });
  } catch (error) {
    return json({ error: { message: (error as Error).message } });
  }
};

export { SignIn as default } from '~/pages/SignIn';

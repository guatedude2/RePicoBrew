import { Authenticator, AuthorizationError } from 'remix-auth';
import { FormStrategy } from 'remix-auth-form';
import { z } from 'zod';
import type { SessionData } from '~/services/session.server';
import { sessionStorage } from '~/services/session.server';
import { UserRepository } from '../repositories/user.server';

// body validator for admins
const bodyValidator = z.object({
  email: z.string().email(),
  password: z.string(),
});

// Create an instance of the authenticator
const authenticator = new Authenticator<SessionData | Error | null>(sessionStorage, {
  sessionKey: 'session',
  throwOnError: true,
});

// Tell the Authenticator to use the form strategy
authenticator.use(
  new FormStrategy(async ({ form }) => {
    // get the data from the form
    const body = bodyValidator.safeParse(Object.fromEntries(form.entries()));
    if (!body.success) {
      throw new AuthorizationError('BAD_ARGUMENTS');
    }

    // validate user against user service
    const user = await UserRepository.validate(body.data.email, body.data.password);
    if (user) {
      const session: SessionData = {
        email: user.email,
        name: user.name,
        expiresAt: Date.now() + 60 * 1000,
        token: `${Math.floor(Date.now() * Math.random())}`,
      };

      return session;
    }

    // throw invalid credentials error
    throw new AuthorizationError('BAD_CREDENTIALS');
  }),
  'user',
);

export default authenticator;

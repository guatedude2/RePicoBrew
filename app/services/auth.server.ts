import { redirect } from 'react-router';
import { UserRepository } from '~/repositories/user.server';
import type { SessionData } from '~/services/session.server';
import { sessionStorage } from '~/services/session.server';

// The cookie-session key the logged-in user's SessionData is stored under.
export const sessionKey = 'session';

export async function authenticateUser(email: string, password: string): Promise<SessionData> {
  const user = await UserRepository.validate(email, password);
  if (!user) {
    throw new Error('BAD_CREDENTIALS');
  }
  return {
    email: user.email,
    name: user.name,
    role: user.role,
    expiresAt: Date.now() + 60 * 1000,
    token: `${Math.floor(Date.now() * Math.random())}`,
  };
}

export async function isAuthenticated(
  request: Request,
  options?: { failureRedirect?: string },
): Promise<SessionData | null> {
  const session = await sessionStorage.getSession(request.headers.get('cookie'));
  const data = session.get(sessionKey) as SessionData | undefined;
  if (!data) {
    if (options?.failureRedirect) {
      throw redirect(options.failureRedirect);
    }
    return null;
  }
  return data;
}

const authenticator = { isAuthenticated, sessionKey };
export default authenticator;

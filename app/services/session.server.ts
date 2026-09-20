import { createCookie, createCookieSessionStorage } from 'react-router';

// export the whole sessionStorage object
// `secure` is deliberately always false, NOT tied to NODE_ENV: this app runs on a Raspberry Pi's
// own local WiFi access point with no TLS certificate at all (see pi-image/), so it's ALWAYS
// served over plain HTTP in "production" too. A `Secure` cookie is silently dropped by the
// browser over a non-HTTPS connection — confirmed the hard way: login appeared to "do nothing"
// on real hardware (server issued a valid session cookie and redirected, but the browser never
// stored it, so the very next request came back unauthenticated).
export const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: 'auth.sessionId', // use any name you want here
    sameSite: 'lax', // this helps with CSRF
    path: '/', // remember to add this so the cookie will work in all routes
    httpOnly: true, // for security reasons, make this cookie http only
    secrets: ['s3cr3t'], // replace this with an actual secret
    secure: false,
  },
});

export const rememberMeCookie = createCookie('auth.rememberId', {
  sameSite: 'lax', // this helps with CSRF
  path: '/', // remember to add this so the cookie will work in all routes
  httpOnly: true, // for security reasons, make this cookie http only
  secrets: ['s3cr3t'], // replace this with an actual secret
  secure: false,
});

// you can also export the methods individually for your own usage
export const { getSession, commitSession, destroySession } = sessionStorage;

// define the session data
export type SessionData = {
  email: string;
  name: string;
  role: string;
  expiresAt: number;
  token: string;
};

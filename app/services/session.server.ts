import { createCookie, createCookieSessionStorage } from 'react-router';

// export the whole sessionStorage object
export const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: 'auth.sessionId', // use any name you want here
    sameSite: 'lax', // this helps with CSRF
    path: '/', // remember to add this so the cookie will work in all routes
    httpOnly: true, // for security reasons, make this cookie http only
    secrets: ['s3cr3t'], // replace this with an actual secret
    secure: process.env.NODE_ENV === 'production', // enable this in prod only
  },
});

export const rememberMeCookie = createCookie('auth.rememberId', {
  sameSite: 'lax', // this helps with CSRF
  path: '/', // remember to add this so the cookie will work in all routes
  httpOnly: true, // for security reasons, make this cookie http only
  secrets: ['s3cr3t'], // replace this with an actual secret
  secure: process.env.NODE_ENV === 'production', // enable this in prod only
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

import { Response } from '@remix-run/node';

export const loader = () => new Response('Not found', { status: 404 });

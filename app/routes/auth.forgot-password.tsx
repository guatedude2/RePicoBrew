import type { LoaderFunctionArgs } from 'react-router';

export const loader = ({ request }: LoaderFunctionArgs) => ({
  host: (request.headers.get('host') ?? new URL(request.url).host).replace(/:\d+$/, ''),
});

export { ForgotPassword as default } from '~/pages/ForgotPassword';

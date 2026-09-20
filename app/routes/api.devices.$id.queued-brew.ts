import type { LoaderFunctionArgs } from 'react-router';
import { data } from 'react-router';
import { getQueuedBrewStatus } from '~/services/queued-brew.server';
import { isAuthenticated } from '~/services/auth.server';

// Polled by the New Session page's waiting screen: has the Pico picked up the brew that was queued
// for it? 'waiting' (still queued), 'picked' (the device has started it), or 'gone' (cancelled or
// expired). Usage: GET /api/devices/:id/queued-brew?session=<sessionId>
export async function loader({ request, params }: LoaderFunctionArgs) {
  if (!(await isAuthenticated(request))) {
    return data({ error: 'Not authenticated' }, { status: 401 });
  }
  const deviceId = parseInt(params.id || '0', 10);
  const sessionId = parseInt(new URL(request.url).searchParams.get('session') || '0', 10);
  if (!deviceId || !sessionId) {
    return data({ error: 'Invalid device or session' }, { status: 400 });
  }
  return { status: await getQueuedBrewStatus(deviceId, sessionId) };
}

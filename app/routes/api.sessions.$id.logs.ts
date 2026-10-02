import type { LoaderFunctionArgs } from 'react-router';
import { data } from 'react-router';
import { listRolledUpReadings } from '~/repositories/session-rollups.server';
import { SessionRepository } from '~/repositories/session.server';
import { requireUser } from '~/services/auth.server';

const DEFAULT_MAX = 600;
const HARD_MAX = 2000;

const num = (value: string | null) => {
  const n = value === null ? NaN : Number(value);
  return Number.isFinite(n) ? n : undefined;
};

// GET /api/sessions/:id/logs?from=<ms>&to=<ms>&max=<n>
// A fermentation session's readings come from its rollups, at the resolution that suits the window. Brew sessions
// (short, with step changes worth keeping) are thinned to about `max` rows (default 600). `from`/`to` return just
// that window, which is how a zoomed-in chart asks for more detail.
export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireUser(request);
  const sessionId = parseInt(params.id || '0');
  if (!sessionId) {
    return data({ error: 'Invalid session ID' }, { status: 400 });
  }
  const url = new URL(request.url);
  const from = num(url.searchParams.get('from'));
  const to = num(url.searchParams.get('to'));
  const rolledUp = await listRolledUpReadings(sessionId, { from, to });
  if (rolledUp) {
    return rolledUp;
  }
  const max = Math.min(HARD_MAX, Math.max(50, num(url.searchParams.get('max')) ?? DEFAULT_MAX));
  return await SessionRepository.listSessionLogsSampled(sessionId, { from, to, max });
}

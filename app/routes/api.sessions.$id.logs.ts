import type { LoaderFunctionArgs } from 'react-router';
import { data } from 'react-router';
import { SessionRepository } from '~/repositories/session.server';
import { requireUser } from '~/services/auth.server';

const DEFAULT_MAX = 600;
const HARD_MAX = 2000;

const num = (value: string | null) => {
  const n = value === null ? NaN : Number(value);
  return Number.isFinite(n) ? n : undefined;
};

// GET /api/sessions/:id/logs?from=<ms>&to=<ms>&max=<n>
// The session's logs thinned to about `max` rows (default 600) so long brews stay cheap to chart; `from`/`to`
// return just that window, which is how a zoomed-in chart asks for more detail.
export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireUser(request);
  const sessionId = parseInt(params.id || '0');
  if (!sessionId) {
    return data({ error: 'Invalid session ID' }, { status: 400 });
  }
  const url = new URL(request.url);
  const max = Math.min(HARD_MAX, Math.max(50, num(url.searchParams.get('max')) ?? DEFAULT_MAX));
  return await SessionRepository.listSessionLogsSampled(sessionId, {
    from: num(url.searchParams.get('from')),
    to: num(url.searchParams.get('to')),
    max,
  });
}

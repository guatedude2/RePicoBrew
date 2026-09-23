import type { ActionFunctionArgs } from 'react-router';
import { data } from 'react-router';
import { analyzeBatch } from '~/services/ai-advisor.server';
import { requireWriter } from '~/services/auth.server';
import { eventStreamResponse } from '~/utils/event-stream.server';

// POST /api/batches/:id/ask-ai — same as the `requestAiAdvice` intent on /api/batches/:id, but streams the
// advice as it is written: `delta` events with text, then `done` (or `error`).
export async function action({ request, params }: ActionFunctionArgs) {
  await requireWriter(request);
  const id = Number(params.id);
  if (request.method !== 'POST' || Number.isNaN(id)) {
    return data({ error: 'Bad request' }, { status: 400 });
  }
  return eventStreamResponse(request, async (send) => {
    const result = await analyzeBatch(id, 'manual', (text) => send('delta', { text }));
    if (result.success) {
      send('done', { adviceId: result.advice.id });
    } else {
      send('error', { error: result.error });
    }
  });
}

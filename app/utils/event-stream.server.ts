type Send = (event: string, data: unknown) => void;

// A `text/event-stream` response driven by `run`. `no-transform` keeps the bundled compression middleware
// from buffering the events; errors thrown by `run` are sent as an `error` event.
export function eventStreamResponse(request: Request, run: (send: Send) => Promise<void>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send: Send = (event, data) => {
        if (closed) {
          return;
        }
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      };
      request.signal.addEventListener('abort', () => {
        closed = true;
      });
      try {
        await run(send);
      } catch (error) {
        console.error('[event-stream] handler failed', error);
        const detail = error instanceof Error ? error.message.split('\n')[0].slice(0, 160) : '';
        send('error', {
          error: `Something went wrong on RePicoBrew's side${detail ? ` (${detail})` : ''}. Try again in a moment.`,
        });
      }
      if (!closed) {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}

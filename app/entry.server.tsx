import { PassThrough } from 'stream';

import createEmotionCache from '@emotion/cache';
import { CacheProvider as EmotionCacheProvider } from '@emotion/react';
import createEmotionServer from '@emotion/server/create-instance';
import isbot from 'isbot';
import { renderToPipeableStream } from 'react-dom/server';
import type { AppLoadContext, EntryContext } from 'react-router';
import { ServerRouter } from 'react-router';

const ABORT_DELAY = 5000;

// Collects a Node stream's output into a single UTF-8 string. Emotion's own
// renderStylesToNodeStream() transform decodes each chunk independently, which can corrupt
// multi-byte characters (en dashes, °, accented letters, ...) whenever one lands on a chunk
// boundary. Buffering the whole response first and decoding once side-steps that entirely, and
// then plugs into Emotion's non-streaming renderStylesToString() instead.
function collectStream(stream: NodeJS.ReadableStream): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    stream.on('error', reject);
  });
}

const renderApp = (
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  onReady: 'onAllReady' | 'onShellReady',
) =>
  new Promise<Response>((resolve, reject) => {
    let didError = false;
    const emotionCache = createEmotionCache({ key: 'css' });

    const { pipe, abort } = renderToPipeableStream(
      <EmotionCacheProvider value={emotionCache}>
        <ServerRouter context={routerContext} url={request.url} />
      </EmotionCacheProvider>,
      {
        [onReady]: async () => {
          try {
            const reactBody = new PassThrough();
            pipe(reactBody);
            const html = await collectStream(reactBody);

            const emotionServer = createEmotionServer(emotionCache);
            const htmlWithStyles = emotionServer.renderStylesToString(html);

            responseHeaders.set('Content-Type', 'text/html; charset=utf-8');

            resolve(
              new Response(htmlWithStyles, {
                headers: responseHeaders,
                status: didError ? 500 : responseStatusCode,
              }),
            );
          } catch (error) {
            reject(error);
          }
        },
        onShellError: (error: unknown) => {
          reject(error);
        },
        onError: (error: unknown) => {
          didError = true;

          console.error(error);
        },
      },
    );

    setTimeout(abort, ABORT_DELAY);
  });

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  _loadContext: AppLoadContext,
) {
  const onReady = isbot(request.headers.get('user-agent')) ? 'onAllReady' : 'onShellReady';
  return renderApp(request, responseStatusCode, responseHeaders, routerContext, onReady);
}

import { PassThrough } from 'stream';

import { createReadableStreamFromReadable } from '@react-router/node';
import isbot from 'isbot';
import { renderToPipeableStream } from 'react-dom/server';
import type { AppLoadContext, EntryContext } from 'react-router';
import { ServerRouter } from 'react-router';

const ABORT_DELAY = 5000;

const renderApp = (
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  onReady: 'onAllReady' | 'onShellReady',
) =>
  new Promise<Response>((resolve, reject) => {
    let didError = false;

    const { pipe, abort } = renderToPipeableStream(<ServerRouter context={routerContext} url={request.url} />, {
      [onReady]: () => {
        const body = new PassThrough();
        const stream = createReadableStreamFromReadable(body);

        responseHeaders.set('Content-Type', 'text/html; charset=utf-8');

        resolve(
          new Response(stream, {
            headers: responseHeaders,
            status: didError ? 500 : responseStatusCode,
          }),
        );

        pipe(body);
      },
      onShellError: (error: unknown) => {
        reject(error);
      },
      onError: (error: unknown) => {
        didError = true;

        console.error(error);
      },
    });

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

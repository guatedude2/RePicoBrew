import type { LoaderFunctionArgs } from 'react-router';
import pubsub from '~/services/pubsub.server';
import { ServerSideResponse } from '~/utils/sse';

const wrapPubSubSignal = <T = unknown>(
  response: ServerSideResponse,
  options: { topic: string; eventName?: string; middleware?: (data: T) => T | Promise<T> },
) => {
  const onEvent = async (data: unknown) => {
    const typed = data as T;
    const payload = options.middleware ? await options.middleware(typed) : typed;
    try {
      await response.send(options.eventName ?? options.topic, payload);
    } catch {
      // Client already disconnected (closed tab, navigation, ...) and the abort listener hasn't
      // unsubscribed this listener yet — writing to a closed stream rejects; nothing to do but
      // drop it, since an unhandled rejection here previously took down the whole process.
    }
  };
  const subId = pubsub.subscribe(options.topic, onEvent);
  response.signal.addEventListener('abort', () => {
    pubsub.unsubscribe(options.topic, subId);
  });
};

export const loader = ({ request }: LoaderFunctionArgs) => {
  const response = new ServerSideResponse(request);

  wrapPubSubSignal(response, { topic: 'device-detected' });
  wrapPubSubSignal(response, { topic: 'device-state-update' });
  wrapPubSubSignal(response, { topic: 'device-availability-update' });
  wrapPubSubSignal(response, { topic: 'session-update' });
  wrapPubSubSignal(response, { topic: 'tilt-update' });
  wrapPubSubSignal(response, { topic: 'tilt-seen' });

  return response;
};

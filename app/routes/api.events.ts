import type { LoaderFunctionArgs } from 'react-router';
import pubsub from '~/services/pubsub.server';
import { ServerSideResponse } from '~/utils/sse';

const wrapPubSubSignal = <T = unknown>(
  response: ServerSideResponse,
  options: { topic: string; eventName?: string; middleware?: (data: T) => T | Promise<T> },
) => {
  const onEvent = async (data: unknown) => {
    console.log('PUB');
    const typed = data as T;
    const payload = options.middleware ? await options.middleware(typed) : typed;
    response.send(options.eventName ?? options.topic, payload);
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

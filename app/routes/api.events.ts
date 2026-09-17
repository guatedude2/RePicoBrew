import type { LoaderFunctionArgs } from 'react-router';
import pubsub from '~/services/pubsub.server';
import { ServerSideResponse } from '~/utils/sse';

const wrapPubSubSignal = <T = unknown>(
  response: ServerSideResponse,
  options: { topic: string; eventName?: string; middleware?: (data: T) => T },
) => {
  const subId = pubsub.subscribe(options.topic, async (data) => {
    console.log('PUB');
    response.send(options.eventName ?? options.topic, options.middleware ? await options.middleware(data) : data);
  });
  response.signal.addEventListener('abort', () => {
    pubsub.unsubscribe(options.topic, subId);
  });
};

export const loader = ({ request }: LoaderFunctionArgs) => {
  const response = new ServerSideResponse(request);

  wrapPubSubSignal(response, { topic: 'device-detected' });
  wrapPubSubSignal(response, { topic: 'device-state-update' });
  wrapPubSubSignal(response, { topic: 'session-update' });
  wrapPubSubSignal(response, { topic: 'tilt-update' });
  wrapPubSubSignal(response, { topic: 'tilt-seen' });

  return response;
};

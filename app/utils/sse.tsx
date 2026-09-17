import type { FC, PropsWithChildren } from 'react';
import { createContext, useContext, useEffect, useState } from 'react';

const context = createContext<EventSource | null>(null);

export type Callback<T> = (data: T) => void;

interface ServerSideEventsProviderProps extends PropsWithChildren {
  url: string;
  withCredentials?: boolean;
}

// server side event hook
export function useServerSideEvent<T>(name: string, callback: Callback<T>) {
  const eventSource = useContext(context);

  useEffect(() => {
    if (!eventSource || !callback) {
      return;
    }

    let previousDataString: string | void = undefined;
    const handleMessageEvent = (messageEvent: MessageEvent) => {
      const { data: dataString } = messageEvent;
      if (dataString === previousDataString) {
        return;
      }
      callback(JSON.parse(dataString));
      previousDataString = dataString;
    };

    eventSource.addEventListener(name, handleMessageEvent);
    return () => {
      eventSource.removeEventListener(name, handleMessageEvent);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, eventSource]);
}

// Server side events provider
export const ServerSideEventsProvider: FC<ServerSideEventsProviderProps> = ({
  url,
  withCredentials = false,
  children,
}) => {
  const [eventSource, setEventSource] = useState<EventSource | null>(null);

  useEffect(() => {
    const source = new EventSource(url, { withCredentials });
    setEventSource(source);
    return () => {
      source.close();
    };
  }, [url, withCredentials]);

  return <context.Provider value={eventSource}>{children}</context.Provider>;
};

// Server side component
export class ServerSideResponse extends Response {
  private writer: WritableStreamDefaultWriter;

  signal: AbortSignal;

  constructor(request: Request, options?: ResponseInit) {
    const signal = request.signal;
    const textEncoder = new TextEncoder();

    const { readable, writable } = new TransformStream({
      start(controller) {
        const handleAbort = () => {
          signal.removeEventListener('abort', handleAbort);
          controller.terminate();
        };
        if (signal.aborted) {
          handleAbort();
        } else {
          signal.addEventListener('abort', handleAbort);
        }
      },
      transform(chunk, controller) {
        controller.enqueue(textEncoder.encode(chunk));
      },
    });

    const mergedHeaders = Object.assign({}, options ? options.headers : {}, {
      'Content-Type': 'text/event-stream',
    });

    const mergedOptions = Object.assign({}, options, {
      headers: mergedHeaders,
    });

    super(readable, mergedOptions);

    this.signal = signal;
    this.writer = writable.getWriter();
  }

  async send(name: string, data: unknown) {
    await this.writer.ready;
    return this.writer.write(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`);
  }
}

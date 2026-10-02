/* eslint-disable no-var */
import { EventEmitter } from 'node:events';

class PubSub {
  private _eventEmitter: EventEmitter;
  constructor() {
    this._eventEmitter = new EventEmitter();
    // Every open live-update stream (one per browser tab) subscribes once to each topic, so Node's default warning
    // at 10 listeners fires with a handful of tabs and devices. 100 still flags a genuine leak.
    this._eventEmitter.setMaxListeners(100);
  }

  public publish<T = unknown>(topic: string, data: T) {
    this._eventEmitter.emit(topic, data);
  }

  public subscribe(topic: string, callback: (data: unknown) => void) {
    this._eventEmitter.addListener(topic, callback);
    return callback;
  }

  public unsubscribe(topic: string, callback: (data: unknown) => void) {
    this._eventEmitter.removeListener(topic, callback);
  }
}

let pubSub: PubSub;

declare global {
  var __pubSub: PubSub | undefined;
}

if (process.env.NODE_ENV === 'production') {
  pubSub = new PubSub();
} else {
  if (!global.__pubSub) {
    global.__pubSub = new PubSub();
  }
  pubSub = global.__pubSub;
}

export default pubSub;

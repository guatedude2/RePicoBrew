/* eslint-disable no-var */
import { EventEmitter } from 'node:events';

class PubSub {
  private _eventEmitter: EventEmitter;
  constructor() {
    this._eventEmitter = new EventEmitter();
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

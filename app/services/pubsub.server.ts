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

  public subscribe<T = unknown>(topic: string, callback: (data: T) => void) {
    const callbackWrapper = (data: T) => callback(data);
    this._eventEmitter.addListener(topic, callbackWrapper);
    return callbackWrapper;
  }

  public unsubscribe(topic: string, callback: (data: string) => void) {
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

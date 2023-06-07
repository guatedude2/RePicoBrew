import { EventEmitter } from 'node:events';

class PubSub {
  private _eventEmitter: EventEmitter;
  constructor() {
    this._eventEmitter = new EventEmitter();
  }

  public publish<T = any>(topic: string, data: T) {
    this._eventEmitter.emit(topic, data);
  }

  public subscribe<T = any>(topic: string, callback: (data: T) => void) {
    const callbackWrapper = (data: T) => callback(data);
    this._eventEmitter.addListener(topic, callbackWrapper);
    return callbackWrapper;
  }

  public unsubscribe(topic: string, callback: (data: string) => void) {
    this._eventEmitter.removeListener(topic, callback);
  }
}

export default new PubSub();

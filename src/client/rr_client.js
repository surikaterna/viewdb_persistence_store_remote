import { forEach, isUndefined } from 'lodash';
import { LoggerFactory } from 'slf';

const log = LoggerFactory.getLogger('viewdb:persistence-store:remote:rr-client');

export default class Client {
  constructor(socket) {
    if (socket) {
      this.connect(socket);
    }
  }

  connect(socket) {
    this._socket = socket;
    this._requests = {};
    this._requestId = 10;

    this._socket.on('/vdb/response', (event) => {
      if (event.e) {
        throw new Error(event.e);
      }
      const request = this._requests[event.i];
      if (isUndefined(request)) {
        log.warn('Response for unregistered request', event);
      } else {
        const callback = request.cb;
        callback(null, event.p);
        if (!request.k) { // non persistent request
          delete this._requests[event.i];
        }
      }
    });
  }

  request(payload, callback, persistent) {
    const req = {
      i: this._requestId++,
      p: payload
    };

    this._requests[req.i] = { cb: callback, k: persistent };
    this._socket.emit('/vdb/request', req);

    return req.i;
  }

  subscribe(payload, callback) {
    const i = this.request(payload, callback, true);
    return {
      stop: () => {
        delete this._requests[i];
      }
    };
  }

  // to signal that a socket reconnection have been made, and that observers need to start over.
  // - socket owner is responsible to ensure that proper authentication/setup have been made before calling this function.
  onClientReconnected() {
    forEach(this._requests, (request, index) => {
      if (request.k) { // persistent aka observe
        const callback = request.cb;
        callback('reconnected');
      } else {
        delete this._requests[index];
      }
    });
  }
}

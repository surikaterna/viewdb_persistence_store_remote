import { forOwn, isNumber, keys } from 'lodash';
import { LoggerFactory } from 'slf';

const log = LoggerFactory.getLogger('viewdb:persistence-store:remote:viewdb-socket-server')

export default class ViewDbSocketServer {
  constructor(viewdb, socket, queryDecorator, globalLimit, readPreference) {
    this._viewdb = viewdb
    this._socket = socket
    this._queryDecorator = queryDecorator ?? ((col, q, cb) => cb(q));
    this._globalLimit = globalLimit;
    this._readPreference = readPreference;

    this._observers = {};

    socket.on('disconnect', this._handleDisconnect);
    socket.on('/vdb/request', this._handleViewDbRequest);
  }

  _handleDisconnect = () => {
    forOwn(this._observers, (observer, handle) => {
      observer.handle.stop()
      delete this._observers[handle];
    });
  };

  _handleViewDbRequest = (request) => {
    if (request.p.find) {
      return this._handleFindRequest(request);
    }

    if (request.p.count) {
      return this._handleCountRequest(request);
    }

    if (request.p.observe) {
      return this._handleObserveRequest(request);
    }

    if (request.p['observe.stop']) {
      return this._handleStopObserveRequest(request);
    }

    throw new Error(`Unknown request from client: ${keys(request)} || ${JSON.stringify(request.p)}`);
  };

  _handleFindRequest = (request) => {
    this._queryDecorator(request.p.collection, request.p.find, (decoratedQuery) => {
      const cursor = this._viewdb.collection(request.p.collection).find(decoratedQuery);

      if (this._readPreference && cursor.setReadPreference) {
        cursor.setReadPreference(this._readPreference);
      }

      if (request.p.sort) {
        cursor.sort(request.p.sort);
      }

      if (isNumber(request.p.limit)) {
        cursor.limit(request.p.limit);
      } else if (this._globalLimit && isNumber(this._globalLimit)) {
        cursor.limit(this._globalLimit);
      }

      if (isNumber(request.p.skip)) {
        cursor.skip(request.p.skip);
      }

      if (request.p.project) {
        if (cursor.project) {
          cursor.project(request.p.project);
        } else {
          log.warn('no support for project on cursor');
        }
      }

      cursor
        .toArray((err, result) => {
          if (err) {
            log.warn('Error: %o', err)
          } else {
            this._socket.emit('/vdb/response', {
              i: request.i,
              p: result
            });
          }
        });
    });
  };

  _handleCountRequest = (request) => {
    this._queryDecorator(request.p.collection, request.p.count, (decoratedQuery) => {
      const cursor = this._viewdb.collection(request.p.collection).find(decoratedQuery);

      if (this._readPreference && cursor.setReadPreference) {
        cursor.setReadPreference(this._readPreference);
      }

      if (isNumber(request.p.limit)) {
        cursor.limit(request.p.limit);
      }

      if (isNumber(request.p.skip)) {
        cursor.skip(request.p.skip);
      }

      cursor.count(true, (err, result) => {
        if (err) {
          log.warn('Error: %o', err)
        } else {
          this._socket.emit('/vdb/response', {
            i: request.i,
            p: result
          });
        }
      });
    });
  };

  _handleObserveRequest = (request) => {
    const observeId = request.p.id;

    this._queryDecorator(request.p.collection, request.p.observe, (decoratedQuery) => {
      const cursor = this._viewdb.collection(request.p.collection).find(decoratedQuery);

      if (this._readPreference && cursor.setReadPreference) {
        cursor.setReadPreference(this._readPreference);
      }

      if (request.p.sort) {
        cursor.sort(request.p.sort);
      }

      if (isNumber(request.p.limit)) {
        cursor.limit(request.p.limit);
      } else if (this._globalLimit && isNumber(this._globalLimit)) {
        cursor.limit(this._globalLimit);
      }

      if (isNumber(request.p.skip)) {
        cursor.skip(request.p.skip);
      }

      if (request.p.project) {
        cursor.project(request.p.project);
      }

      const observeOptions = {
        init: (result) => {
          sendChange(this._socket, { i: { r: result } }, request);
        },
        added: (e, index) => {
          sendChange(this._socket, { a: { e: e, i: index } }, request);
        },
        removed: (e, index) => {
          sendChange(this._socket, { r: { e: e, i: index } }, request);
        },
        changed: (asis, tobe, index) => {
          sendChange(this._socket, { c: { o: asis, n: tobe, i: index } }, request);
        },
        moved: (e, oldIndex, newIndex) => {
          sendChange(this._socket, { m: { e: e, o: oldIndex, n: newIndex } }, request);
        },
        oplog: true
      };

      if (request.p.events) {
        if (!request.p.events.i) {
          delete observeOptions.init;
        }

        if (!request.p.events.a) {
          delete observeOptions.added;
        }

        if (!request.p.events.r) {
          delete observeOptions.removed;
        }

        if (!request.p.events.c) {
          delete observeOptions.changed;
        }

        if (!request.p.events.m) {
          delete observeOptions.moved;
        }
      }

      const observeHandle = cursor.observe(observeOptions);

      this._observers[observeId] = {
        i: request.i
        , handle: observeHandle
      };

      this._socket.emit('/vdb/response', {
        i: request.i,
        p: {
          handle: observeId
        }
      });
    });
  };

  _handleStopObserveRequest = (request) => {
    const handle = request.p['observe.stop'].h;
    if (handle) {
      if (this._observers[handle]) {
        this._observers[handle].handle.stop();
        delete this._observers[handle];
      } else {
        log.error('Observer not registered on this server: %s', handle);
      }
    } else {
      log.warn('Observe stopped failed: %s', handle);
    }
  };
}

function sendChange(socket, change, request) {
  socket.emit('/vdb/response', {
    i: request.i,
    p: {
      changes: [change]
    }
  });
}

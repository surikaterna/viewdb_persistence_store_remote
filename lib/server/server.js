var _ = require('lodash');

var ViewDbSocketServer = function (viewdb, socket, queryDecorator, globalLimit, readPreference) {
  var _observers = {};
  var _queryDecorator;
  if (!queryDecorator) {
    _queryDecorator = function (col, q, cb) {
      cb(q);
    };
  } else {
    _queryDecorator = queryDecorator;
  }
  socket.on('disconnect', function () {
    _.forOwn(_observers, function (observer, handle) {
      observer.handle.stop();
      delete _observers[handle];
    });
  });
  socket.on('/vdb/request', function (request) {
    if (request.p.find) {
      _queryDecorator(request.p.collection, request.p.find, function (decoratedQuery) {
        var cursor = viewdb.collection(request.p.collection).find(decoratedQuery);
        if (readPreference && cursor.setReadPreference) {
          cursor.setReadPreference(readPreference);
        }
        if (request.p.sort) {
          cursor.sort(request.p.sort);
        }
        if (_.isNumber(request.p.limit)) {
          cursor.limit(request.p.limit);
        } else if (globalLimit && _.isNumber(globalLimit)) {
          cursor.limit(globalLimit);
        }
        if (_.isNumber(request.p.skip)) {
          cursor.skip(request.p.skip);
        }
        if (request.p.project) {
          if (cursor.project) {
            cursor.project(request.p.project);
          } else {
            console.log('warn: no support for project on cursor');
          }
        }
        cursor.toArray(function (err, result) {
          if (err) {
            console.log(err);
          } else {
            socket.emit('/vdb/response', {
              i: request.i,
              p: result
            });
          }
        });
      });
    } else if (request.p.count) {
      _queryDecorator(request.p.collection, request.p.count, function (decoratedQuery) {
        var cursor = viewdb.collection(request.p.collection).find(decoratedQuery);
        if (readPreference && cursor.setReadPreference) {
          cursor.setReadPreference(readPreference);
        }
        if (_.isNumber(request.p.limit)) {
          cursor.limit(request.p.limit);
        }
        if (_.isNumber(request.p.skip)) {
          cursor.skip(request.p.skip);
        }
        cursor.count(true, function (err, result) {
          if (err) {
            console.log(err);
          } else {
            socket.emit('/vdb/response', {
              i: request.i,
              p: result
            });
          }
        });
      });
    } else if (request.p.observe) {
      var observeId = request.p.id;
      _queryDecorator(request.p.collection, request.p.observe, function (decoratedQuery) {
        var cursor = viewdb.collection(request.p.collection).find(decoratedQuery);
        if (readPreference && cursor.setReadPreference) {
          cursor.setReadPreference(readPreference);
        }
        if (request.p.sort) {
          cursor.sort(request.p.sort);
        }
        if (_.isNumber(request.p.limit)) {
          cursor.limit(request.p.limit);
        } else if (globalLimit && _.isNumber(globalLimit)) {
          cursor.limit(globalLimit);
        }
        if (_.isNumber(request.p.skip)) {
          cursor.skip(request.p.skip);
        }
        if (request.p.project) {
          cursor.project(request.p.project);
        }
        var observeOptions = {
          init: function (result) {
            sendChange(socket, { i: { r: result } }, request);
          },
          added: function (e, index) {
            sendChange(socket, { a: { e: e, i: index } }, request);
          },
          removed: function (e, index) {
            sendChange(socket, { r: { e: e, i: index } }, request);
          },
          changed: function (asis, tobe, index) {
            sendChange(socket, { c: { o: asis, n: tobe, i: index } }, request);
          },
          moved: function (e, oldIndex, newIndex) {
            sendChange(socket, { m: { e: e, o: oldIndex, n: newIndex } }, request);
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

        var observeHandle = cursor.observe(observeOptions);
        _observers[observeId] = {
          i: request.i,
          handle: observeHandle
        };
        socket.emit('/vdb/response', {
          i: request.i,
          p: {
            handle: observeId
          }
        });
      });
    } else if (request.p['observe.stop']) {
      var handle = request.p['observe.stop'].h;
      if (handle) {
        if (_observers[handle]) {
          _observers[handle].handle.stop();
          delete _observers[handle];
        } else {
          console.error('Observer not registered on this server: ' + handle);
        }
      } else {
        console.log('Observe stopped failed: ' + request.p['observe.stop'].h);
      }
    } else {
      throw new Error('Unknown request from client: ' + _.keys(request) + ' || ' + JSON.stringify(request.p));
    }
  });
};

function sendChange(socket, change, request) {
  socket.emit('/vdb/response', {
    i: request.i,
    p: {
      changes: [change]
    }
  });
}

module.exports = ViewDbSocketServer;

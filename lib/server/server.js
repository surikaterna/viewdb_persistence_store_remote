var _ = require('lodash');
var uuid = require('node-uuid').v4;

var ViewDbSocketServer = function (viewdb, socket, queryDecorator) {
  var _observers = {};
  var _queryDecorator;
  if (!queryDecorator) {
    _queryDecorator = function (col, q, cb) {
      cb(q);
    }
  } else {
    _queryDecorator = queryDecorator;
  }
  socket.on('/vdb/request', function (request) {
    if (request.p.find) {
      _queryDecorator(request.p.collection, request.p.find, function (decoratedQuery) {
        viewdb.collection(request.p.collection).find(decoratedQuery).toArray(function (err, result) {
          if (err) {
            console.log(err)
          } else {
            socket.emit('/vdb/response',
              {
                i: request.i,
                p: result
              });
          }
        });
      });
    } else if (request.p.observe) {
      var observeId = request.p.id;
      _queryDecorator(request.p.collection, request.p.observe, function (decoratedQuery) {
        var observeHandle = viewdb.collection(request.p.collection).find(decoratedQuery).observe({
          init: function (result) {
            sendChange(socket, { i: { r: result }}, request);
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
          }
        });
        _observers[observeId] = {
          i: request.i
          , handle: observeHandle
        };
        socket.emit('/vdb/response', {
          i: request.i,
          p: {
            handle: observeId
          }
        });
      });

    } else if (request.p["observe.stop"]) {
      var handle = request.p["observe.stop"].h;
      if (handle) {
        if (_observers[handle]) {
          _observers[handle].handle.stop();
          delete _observers[handle];
        } else {
          console.error("Observer not registered on this server: " + handle);
        }
      } else {
        console.log("Observe stopped failed: " + request.p["observe.stop"].h);
      }
    }
    else {
      throw new Error("Unknown request from client: " + _.keys(request) + " || " + JSON.stringify(request.p));
    }
  });
}

function sendChange(socket, change, request) {
  socket.emit('/vdb/response', {
    i: request.i,
    p: {
      changes: [change]
    }
  });
}

module.exports = ViewDbSocketServer;
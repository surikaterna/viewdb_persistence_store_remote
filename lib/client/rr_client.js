var _ = require('lodash');
var debug = require('debug');
var warn = debug('viewdb:warn');

var Client = function (socket) {
  if (socket) {
    this.connect(socket);
  }
};

Client.prototype.connect = function (socket) {
  this._socket = socket;
  this._requests = {};
  this._requestId = 10;
  var self = this;
  this._socket.on('/vdb/response', function (event) {
    if (event.e) {
      throw new Error(event.e);
    }
    var request = self._requests[event.i];
    if (_.isUndefined(request)) {
      warn('Response for unregistered request', event);
    } else {
      var callback = request.cb;
      callback(null, event.p);
      if (!request.k) {
        // non persistent request
        delete self._requests[event.i];
      }
    }
  });
};

Client.prototype.request = function (payload, callback, persistent) {
  var req = {
    i: this._requestId++,
    p: payload
  };
  this._requests[req.i] = { cb: callback, k: persistent };
  this._socket.emit('/vdb/request', req);
  return req.i;
};

Client.prototype.subscribe = function (payload, callback) {
  var self = this;
  var i = this.request(payload, callback, true);
  return {
    stop: function () {
      delete self._requests[i];
    }
  };
};

// to signal that a socket reconnection have been made, and that observers need to start over.
// - socket owner is responsible to ensure that proper authentication/setup have been made before calling this function.
Client.prototype.onClientReconnected = function () {
  var self = this;
  _.forEach(this._requests, function (request, index) {
    if (request.k) {
      // persistent aka observe
      var callback = request.cb;
      callback('reconnected');
    } else {
      delete self._requests[index];
    }
  });
};

module.exports = Client;

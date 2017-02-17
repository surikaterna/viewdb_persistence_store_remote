var LoggerFactory = require('slf').LoggerFactory;
var uuid = require('node-uuid').v4;
var Logger = require('slf').Logger;
var LOG = Logger.getLogger('lx:viewdb-persistence-store-remote');
var _ = require('lodash');

var Cursor = require('viewdb').Cursor;
var util = require('util');
var EventEmitter = require('events').EventEmitter;

var RemoteCursor = function (collection, query, options, getDocuments) {
  Cursor.call(this, collection, query, options, getDocuments);
	this.handles = [];
}

util.inherits(RemoteCursor, Cursor);

RemoteCursor.prototype._buildParams = function (defaults, method) {
  var q = this._query.query || this._query;
  var skip, limit, sort;
  if (this._query.query) {
    skip = this._query.skip;
    limit = this._query.limit;
    sort = this._query.sort;
  }
  var params = _.defaults({
    id: uuid(),
    observe: q,
    collection: this._collection._name,
    skip: skip,
    limit: limit,
    sort: sort
  }, defaults);

  if (method) {
    params.method = method;
  }
  return params;
}

RemoteCursor.prototype.count = function (applySkipLimit, callback) {
  var cb = _.isFunction(applySkipLimit) ? applySkipLimit : callback;
  var skipLimit = !_.isFunction(applySkipLimit) ? applySkipLimit : false;

  var params = this._buildParams({ applySkipLimit: skipLimit }, 'count');
  this._collection._client.request(params, function (err, result) {
    cb(err, result);
  });
};

RemoteCursor.prototype.sort = function (params) {
  this._query.sort = params;
  this._refresh();
  return this;
}

RemoteCursor.prototype.observe = function (options) {
  var self = this;
  var remoteHandle = null;
  var events = {
    a: options.added ? true : false
    , r: options.removed ? true : false
    , c: options.changed ? true : false
    , m: options.moved ? true : false
  };

  var params = this._buildParams({
    events: events
  });

  var self = this;
  var handle = this._collection._client.subscribe(params, function (err, result) {
    if (result.handle) {
      remoteHandle = result.handle;

      if (self.handles.indexOf(params.id) > -1) {
        self._collection._client.request({ "observe.stop": { h: params.id } });
        handle.stop();
        _.remove(self.handles, params.id);
      } else {
        _.forEach(result.changes, function (c) {
          //			console.log(c);
          if (c.a) { //added
            //			console.log("RCVD A");
            options.added(c.a.e, c.a.i);
          } else if (c.r) { //removed
            //			console.log("RCVD R");
            options.removed(c.r.e, c.r.i);
          } else if (c.c) { //changed
            //			console.log("RCVD C");
            options.changed(c.c.o, c.c.n, c.c.i);
          } else if (c.m) { //moved
            //			console.log("RCVD M");
            options.moved(c.m.e, c.m.o, c.m.n);
          }
        });
      }
    }
  });

  return {
    stop: function () {
      if (!remoteHandle) {
        log.warn("WARN unsubscribing before receiving subscription handle from server");
        self.handles.push(params.id);
      } else {
        self._collection._client.request({ "observe.stop": { h: params.id } });
        handle.stop();
      }
    }
  }
};

module.exports = RemoteCursor;
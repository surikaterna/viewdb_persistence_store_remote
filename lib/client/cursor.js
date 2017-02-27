var uuid = require('node-uuid').v4;
var Logger = require('slf').Logger;
var LOG = Logger.getLogger('lx:viewdb-persistence-store-remote');
var _ = require('lodash');

var Cursor = require('viewdb').Cursor;
var util = require('util');

var RemoteCursor = function (collection, query, options, getDocuments) {
  Cursor.call(this, collection, query, options, getDocuments);
	this.handles = [];
  console.log("*** creating RemoteCursor", query);
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
  console.log("*** _buildParams", params);
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

  console.log('STARTING OBSERVE ', params);

  var handle = this._collection._client.subscribe(params, function (err, result) {
    if (remoteHandle || result.handle) {
      remoteHandle = result.handle;

      if (self.handles.indexOf(params.id) > -1) {
        console.log("*** handle with id", params.id, "already registered", self.handles);
        self._collection._client.request({ "observe.stop": { h: params.id } });
        handle.stop();
        _.pull(self.handles, params.id);
        console.log("*** after pull", self.handles);
      } else {
        _.forEach(result.changes, function (c) {
          //			console.log(c);
          if (c.a) { //added
            console.log("**** =====> client got ADD", c.a);
            //			console.log("RCVD A");
            options.added(c.a.e, c.a.i);
          } else if (c.r) { //removed
                        console.log("**** =====> client got REMOVE", c.r);

            //			console.log("RCVD R");
            options.removed(c.r.e, c.r.i);
          } else if (c.c) { //changed
                        console.log("**** =====> client got CHANGED", c.c);

            //			console.log("RCVD C");
            options.changed(c.c.o, c.c.n, c.c.i);
          } else if (c.m) { //moved

                        console.log("**** =====> client got MOVED", c.m);

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
        LOG.warn("WARN unsubscribing before receiving subscription handle from server");
        console.log("*** pushing", params.id);
        self.handles.push(params.id);
        console.log("***", self.handles);
      } else {
        console.log("*** client stopping observer", params.id);
        self._collection._client.request({ "observe.stop": { h: params.id } });
        handle.stop();
      }
    }
  }
};

module.exports = RemoteCursor;
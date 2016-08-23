var _ = require('lodash');

var Cursor = require('viewdb').Cursor;
var util = require('util');
var EventEmitter = require('events').EventEmitter;

var RemoteCursor = function(collection, query, options, getDocuments) {
	Cursor.call(this, collection, query, options, getDocuments);
}

util.inherits(RemoteCursor, Cursor);

RemoteCursor.prototype.observe = function(options) {
	var self = this;
	var remoteHandle = null;
	var events = {
		  a : options.added ? true : false
		, r : options.removed ? true : false
		, c : options.changed ? true : false
		, m : options.moved ? true : false
	};

	var q = this._query.query || this._query;
	var skip, limit;
	if(this._query.query) {
		skip = this._query.skip;
		limit = this._query.limit;
	}
	var params = {
		observe: q,
		collection: this._collection._name,
		skip: skip,
		limit: limit,
    events: events
	};

	var handle = this._collection._client.subscribe(params, function(err, result) {
		if(result.handle) {
			remoteHandle = result.handle;
		}

		_.forEach(result.changes, function(c) {
//			console.log(c);
			if(c.a) { //added
//			console.log("RCVD A");
				options.added(c.a.e, c.a.i);
			} else if(c.r) { //removed
//			console.log("RCVD R");
				options.removed(c.r.e, c.r.i);
			} else if(c.c) { //changed
//			console.log("RCVD C");
				options.changed(c.c.o, c.c.n, c.c.i);
			} else if (c.m) { //moved
//			console.log("RCVD M");
				options.moved(c.m.e, c.m.o, c.m.n);
			}
		});
	});

	return {
		stop:function() {
			if(!remoteHandle) {
//				console.log("WARN unsubscribing before receiving subscription handle from server");
			}
//			console.log("unsubscribing from " + remoteHandle);
			self._collection._client.request({"observe.stop":{h:remoteHandle}});
			handle.stop();
		}
	}
};


module.exports = RemoteCursor;
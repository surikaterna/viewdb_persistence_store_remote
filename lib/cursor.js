var Cursor = require('viewdb').Cursor;
var utils = require('utils');

var RemoteCursor = function(collection, query, options, getDocuments) {
	Cursor.call(this, collection, query, options, getDocuments);
}

utils.inherit(RemoteCursor, EventEmitter);

RemoteCursor.prototype.observe = function(options) {
	var remoteHandle = null;
	var events = {
		  c : options.changed ? true : false
		, r : options.removed ? true : false
		, c : options.changed ? true : false
		, m : options.moved ? true : false
	}

	var handle = this._collection._client.subscribe({observe:this._query, collection:this._collection._name, events:events}, function(err, result) {
		remoteHandle = result.handle;
		_.forEach(result.changes, function(c) {
			if(c.a) { //added
				options.added(c.a.e, c.a.i);
			} else if(c.r) { //removed
				options.removed(c.a.e, c.a.i);
			} else if(c.c) { //changed
				options.changed(c.a.o, c.a.n, c.a.i);
			} else if (c.m) { //moved
				options.moved(c.a.e, c.a.o, c.a.n);
			}
		});
	});

	return {
		stop:function() {
			if(!remoteHandle) {
				console.log("WARN unsubscribing before receiving subscription handle from server");
			}
			this._collection._client.request({"observe.stop":remoteHandle});
			handle.stop();
		}
	}
};


module.exports = RemoteCursor;
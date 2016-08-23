var Promise = require('bluebird');
var _ = require('lodash');
//var uuid = require('node-uuid').v4;
//var Kuery = require('kuery');
var Cursor = require('./cursor');
var EventEmitter = require('events').EventEmitter;
var util = require('util');


var Collection = function(client, collectionName) {
	EventEmitter.call(this);
	this._client = client;
	this._name = collectionName;
}

util.inherits(Collection, EventEmitter);

Collection.Cursor = Cursor;

Collection.prototype.find = function(query, options) {
	if(this._isIdentityQuery(query)) {
		var id = query.id;
		return [];
	} else {
		return new Cursor(this, {query: query}, options, this._getDocuments.bind(this));
	}
}

Collection.prototype.insert = function(document, options, callback) {
	throw new Error("Not implemented");
/*	if(callback) {
		callback(null, document);
	}
*/
}

Collection.prototype.save = function(document, options, callback) {
	throw new Error("Not implemented");
/*	if(callback) {
		callback(null, document);
	}
*/
}

Collection.prototype.remove = function(document, options, callback) {
	throw new Error("Not implemented");
/*	if(callback) {
		callback(null, document);
	}
*/
}

Collection.prototype._getDocuments = function(query, callback) {
	var q = query.query || query;
	var skip, limit;
	if(query.query) {
		skip = query.skip;
		limit = query.limit;
	}
	var params = {
		find: q,
    collection: this._name,
		skip: skip,
		limit: limit
	};

	this._client.request(params, function(err, res) {
		if(err) {
			callback(err);
		} else {
			callback(null, res);
		}
	});
/*	var uri = "/db/request" + this._name;
	if(!_.eq(query,{})) {
		uri+="?q=" + JSON.stringify(query);
	}

	this._socket.emit('uri', function(err, body, response) {
		callback(err, body);
	});
*/

/*	var txn = this._db.transaction(['documents'], 'readonly');
	var docs = txn.objectStore('documents');
	var cursor = docs.index('$collection').openCursor(this._name);
	var result = [];
	cursor.onerror = function(event) {
		callback(new Error(event));
	};
	cursor.onsuccess = function(event) {
		var c = event.target.result;
		if(c) {
			result.push(c.value);
			c.continue();
		} else {
			//get indexeddb to sort?
			var q = new Kuery(query);
			callback(null, q.find(result));
		}
	}
*/
};

Collection.prototype._isIdentityQuery = function(query) {
	return false;
}

module.exports = Collection;
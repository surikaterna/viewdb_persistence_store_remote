var Promise = require('bluebird');
var _ = require('lodash');
//var uuid = require('node-uuid').v4;
//var Kuery = require('kuery');
var Cursor = require('./cursor');
var EventEmitter = require('events').EventEmitter;
var util = require('util');
var uuid = require('node-uuid').v4;


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

Collection.prototype._buildParams = function(query, method) {
	var q = query.query || query;
	var skip, limit, sort;
	if(query.query) {
		skip = query.skip;
		limit = query.limit;
		sort = query.sort;
	}
	var params = {
		collection: this._name,
		skip: skip,
		limit: limit,
		find: q,
		sort: sort
	};
	if(method) {
		params.method = method;
	}

	return params;
}


Collection.prototype._getDocuments = function(query, callback) {
	var params = this._buildParams(query);
	this._client.request(params, function(err, res) {
		if(err) {
			callback(err);
		} else {
			callback(null, res);
		}
	});
};

Collection.prototype.count = function (query, options, callback) {
  if (_.isFunction(query)) {
    callback = query;
    query = {};
  }
  if (_.isFunction(options)) {
    callback = options;
    options = {};
  }

  var params = {
    id: uuid(),
    count: query,
    collection: this._name,
  };

  if (options) {
    if (options.limit) {
      params.limit = options.limit;
    }
    if (options.skip) {
      params.skip = options.skip;
    }
  }

  this._client.request(params, function (err, result) {
    callback(err, result);
  });
};

Collection.prototype._isIdentityQuery = function(query) {
	return false;
}

module.exports = Collection;
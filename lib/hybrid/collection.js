var _ = require('lodash');

var HybridCursor = require('./cursor');


var HybridCollection = function(local, remote, name, options) {
	this._local = local;
	this._remote = remote;
	this._name = name;
	this._options = options;
}

HybridCollection.prototype.find = function(query, options) {
	return new HybridCursor(query, this._local.find(query, options), this._remote.find(query, options), options, this._options);
};

HybridCollection.prototype.save = function(doc, callback) {
	if(this._options.syncWrites) {
		this._remote.save(doc, callback);
	}
	return this._local.save(doc, callback);
}

HybridCollection.prototype.insert = function(doc, callback) {
	var self = this;
	return this._local.insert(doc, function(err, result) {
		if(self._options.syncWrites) {
			self._remote.insert(doc, callback);
		}
		if(callback) {
			callback(err, result);
		}
	});
}

HybridCollection.prototype.remove = function(query, options, callback) {
	var self = this;
	return this._local.remove(query, options, function(err, result) {
		if(self._options.syncWrites) {
			self._remote.remove(query, options);
		}
		if(callback) {
			callback(err, result);
		}
	});
}

module.exports = HybridCollection;
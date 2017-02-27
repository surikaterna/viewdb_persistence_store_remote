var Kuery = require('kuery');

var Observe = require('./observe');

var reconcile = require('./reconcile');
var HybridCursor = function(query, local, remote, findOptions, options) {
	this._query = query;
	this._kuery = new Kuery(this._query);
	this._local = local;
	this._remote = remote;
	this._findOptions = findOptions;
	this._options = options;
}

HybridCursor.prototype.toArray = function(callback) {
	//reconcile strategy
	var self = this;
	var localData = null;
	var remoteData = null;
	var localErr = null;
	var remoteErr = null;

	function serverResult(err, result) {
		if(err) {
			remoteErr = err;
			result = result || [];
			if(self._options.throwRemoteErr) {
				return callback(err);
			}
		}
		remoteData = result;
		console.log('FROM SERVER', self._query, result);
		if(localData) {
			callback(null, self._kuery.find(reconcile(localData, remoteData)));
		}
	}

	function localResult(err, result) {
		if(err) {
			localErr = err;
			return callback(err, result);
		}

		localData = result;
		console.log('FROM LOCAL', self._query, result);
		if(remoteData || remoteErr) {
			if(!(remoteErr && self._options.throwRemoteErr)) {
				callback(null, self._kuery.find(reconcile(localData, remoteData || [])));
			}
		} else {
			if(self._options.localFirst) {
				callback(err, localData);
			}
		}
	}

	this._local.toArray(localResult);
	this._remote.toArray(serverResult);
};


HybridCursor.prototype.observe = function(options) {
	return new Observe(this._local, this._remote, this._options, options);
}

module.exports = HybridCursor;
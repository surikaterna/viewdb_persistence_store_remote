var _ = require('lodash');
var Collection = require('./collection');

var defaultOptions = {
	  syncWrites: false // if local writes should be sent over the wire to remote
	, cacheReads: true  // when reading remote documents should they be stored in the local db
	, localFirst: true   // when reading documents should we return the locally cached ones first and then the remote ones when they arrive
	, throwRemoteErr: false //if remote throws should we swallow them or throw them to client
	, throttleObserveRefresh:200
}

var HybridStore = function(local, remote, options) {
	this._local = local;
	this._remote  = remote;
	this._options = _.defaults(options || {}, defaultOptions);	
	this._collections = {};	
}

HybridStore.prototype.collection = function(name, callback) {
	var collection = this._collections[name];
	if(!collection) {
		var local = this._local.collection(name);
		var remote = this._remote.collection(name);
		collection = this._collections[name] = new Collection(
			  local
			, remote
			, name
			, this._options);
	}
	if(callback) {
		callback(collection);
	}
	return collection;
}

module.exports = HybridStore;
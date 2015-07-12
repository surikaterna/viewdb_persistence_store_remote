var _ = require('lodash');
var reconcile = require('./reconcile');
var merge = require('viewdb').merge;

function buildOptions(cache, callback) {

	return {
        added:function(e, index) {
          cache.splice(index, 0, e);
          callback(e);
        },
        removed:function(e, index) {
          cache.splice(index, e);
          callback(e);
        },
        changed:function(asis, tobe, index) {
          cache[index] = tobe;
          callback(tobe);
        },
        moved:function(e, oldIndex, newIndex) {
          cache.splice(oldIndex, 1);
          //add
          cache.splice(newIndex, 0, e);
			callback(e);
        }
	}
}

var HybridObserver = function(localCursor, remoteCursor, collectionOptions, options) {
	var self = this;

	this._localCursor = localCursor;
	this._remoteCursor = remoteCursor;
	this._options = options;

	this._localCache = [];
	this._remoteCache = [];
	this._reconciledCache = [];

	//make sure refresh is only called once every x ms

	var _refresh = _.throttle(this.refresh.bind(this), collectionOptions.throttleObserveRefresh);
	
	this._localHandle = this._localCursor.observe(buildOptions(this._localCache, _refresh));
	this._remoteHandle = this._remoteCursor.observe(buildOptions(this._remoteCache, _refresh));
	return {
		stop: function() {
			//Help garbage collection? :)
			this._localCache = null;
			this._remoteCache = null;
			this._reconciledCache = null;
			self._localHandle.stop();
			self._remoteHandle.stop();
		}
	}
}

HybridObserver.prototype.refresh = function() {
	var self = this;
	var result = reconcile(this._localCache, this._remoteCache);
	var old = self._reconciledCache;
	this._reconciledCache = merge(old, result, _.defaults({comparatorId:  function(a,b) {return a._id === b._id}}, self._options));
}

module.exports = HybridObserver;
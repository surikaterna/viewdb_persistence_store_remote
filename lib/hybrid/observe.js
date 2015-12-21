var _ = require('lodash');
var reconcile = require('./reconcile');
var merge = require('viewdb').merge;

function buildOptions(cache, callback, removed, isRemote, cache2) {

	return {
        added:function(e, index) {
          console.log("OPT added");
          cache.splice(index, 0, e);
          if(isRemote && removed.length > 0) {
          	removed = [];
          }
          callback(e);
        },
        removed:function(e, index) {
        	console.log("OPT removed");
          cache.splice(index, 1);
          if(removed && !isRemote) {
          	console.log("***Removing it from remote cache as well for responsiveness...");
			removed.push(e._id);
          } 
          if(isRemote && removed.length > 0) {
          	removed = [];
          }

          callback(e);
        },
        changed:function(asis, tobe, index) {
        	console.log("OPT changed");
          cache[index] = tobe;
          if(isRemote && removed.length > 0) {
          	removed = [];
          }
          callback(tobe);
        },
        moved:function(e, oldIndex, newIndex) {
       	console.log("OPT moved");

          cache.splice(oldIndex, 1);
          //add
          cache.splice(newIndex, 0, e);
          if(isRemote && removed.length > 0) {
          	removed = [];
          }
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
	this._removed = [];
	this._reconciledCache = [];

	//make sure refresh is only called once every x ms

	var _refresh = _.throttle(this.refresh.bind(this), collectionOptions.throttleObserveRefresh);
	
	this._localHandle = this._localCursor.observe(buildOptions(this._localCache, _refresh, this._removed, false, this._remoteCache));
	this._remoteHandle = this._remoteCursor.observe(buildOptions(this._remoteCache, _refresh, this._removed, true));
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
	//remove elements which have been removed locally in the remote cache as well so they "disappear"

	var remoteCache = this._remoteCache;
	if(this._removed.length > 0) {
		remoteCache = _.filter(this._remoteCache, function(doc) {
			return !_.includes(self._removed, doc._id);
		});
	}
	console.log('##################', remoteCache.length, this._remoteCache.length);
	var result = reconcile(this._localCache, remoteCache);

	var old = self._reconciledCache;
	this._reconciledCache = merge(old, result, _.defaults({comparatorId:  function(a,b) {return a._id === b._id}}, self._options));
}

module.exports = HybridObserver;
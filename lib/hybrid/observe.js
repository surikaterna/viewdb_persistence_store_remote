var _ = require('lodash');
var reconcile = require('./reconcile');
var merge = require('viewdb').merge;
function pushArray(arr, arr2) {
  arr.push.apply(arr, arr2);
}

function buildOptions(cache, callback, removed, isRemote, onRemoteChange) {
  return {
    init: function (result) {
      // console.log('init', result, cache)
      if (_.isEmpty(cache)) {
        pushArray(cache, result);
      } else {
        // if array is empty init is called a second time - reuse reconcile logic.
        cache.length = 0;
        pushArray(cache, result);
      }
      if (isRemote && _.isFunction(onRemoteChange)) {
        onRemoteChange();
      }
      callback(result);
    },
    added: function (e, index) {
      // console.log("OPT added");
      cache.splice(index, 0, e);
      if (isRemote && removed.length > 0) {
        removed = [];
      }
      if (isRemote && _.isFunction(onRemoteChange)) {
        onRemoteChange();
      }
      callback(e);
    },
    removed: function (e, index) {
      // console.log("OPT removed");
      cache.splice(index, 1);
      if (removed && !isRemote) {
        // console.log("***Removing it from remote cache as well for responsiveness...");
        removed.push(e._id);
      }
      if (isRemote && removed.length > 0) {
        removed = [];
      }
      if (isRemote && _.isFunction(onRemoteChange)) {
        onRemoteChange();
      }
      callback(e);
    },
    changed: function (asis, tobe, index) {
      // console.log("OPT changed");
      cache[index] = tobe;
      if (isRemote && removed.length > 0) {
        removed = [];
      }
      if (isRemote && _.isFunction(onRemoteChange)) {
        onRemoteChange();
      }
      callback(tobe);
    },
    moved: function (e, oldIndex, newIndex) {
      // console.log("OPT moved");

      cache.splice(oldIndex, 1);
      // add
      cache.splice(newIndex, 0, e);
      if (isRemote && removed.length > 0) {
        removed = [];
      }
      if (isRemote && _.isFunction(onRemoteChange)) {
        onRemoteChange();
      }
      callback(e);
    }
  }
}

/**
 * @param {*} localCursor Local cursor
 * @param {*} remoteCursor Remote cursor
 * @param {object} collectionOptions Options supplied from collection
 * @param {object} options Options to callback on data change
 * @param {*} cacheCallback Callback for when cache should be updated
 * @param {*} getCache Getter for retrieving data that is stored in local cache.
 */
var HybridObserver = function (localCursor, remoteCursor, collectionOptions, options, cacheCallback, getCache) {
  var self = this;

  this._initialized = false;
  this._localCursor = localCursor;
  this._remoteCursor = remoteCursor;
  this._options = options;
  this._cacheCallback = cacheCallback;

  this._localCache = [];
  this._remoteCache = [];
  this._removed = [];
  this._reconciledCache = [];
  this._remoteHasChanged = false;

  // make sure refresh is only called once every x ms
  var _refresh = _.throttle(this.refresh.bind(this), collectionOptions.throttleObserveRefresh);

  this._localHandle = this._localCursor.observe(buildOptions(this._localCache, _refresh, this._removed, false));

  var remoteOptions = buildOptions(this._remoteCache, _refresh, this._removed, true, this._onRemoteChange.bind(this));
  if (!getCache) {
    this._remoteHandle = this._remoteCursor.observe(remoteOptions);
  } else {
    getCache(function (err, data) {
      if (data) {
        self._remoteCache = data;
        delete remoteOptions.init;
      }
      self._remoteHandle = self._remoteCursor.observe(remoteOptions);
    });
  }

  return {
    stop: function () {
      // Help garbage collection? :)
      this._localCache = null;
      this._remoteCache = null;
      this._reconciledCache = null;
      self._localHandle.stop();
      self._remoteHandle.stop();
    }
  };
};

HybridObserver.prototype._onRemoteChange = function () {
  this._remoteHasChanged = true;
};

HybridObserver.prototype.refresh = function () {
  var self = this;
  // console.log('refresh');
  // remove elements which have been removed locally in the remote cache as well so they "disappear"

  var remoteCache = this._remoteCache;
  if (this._removed.length > 0) {
    remoteCache = _.filter(this._remoteCache, function (doc) {
      return !_.includes(self._removed, doc._id);
    });
  }
  // console.log('##################', remoteCache.length, this._remoteCache.length);
  var result = reconcile(this._localCache, remoteCache);

  if (!this._initialized && this._options.init) {
    this._initialized = true;
    self._reconciledCache = result;
    this._options.init(result);
  } else {
    var old = self._reconciledCache;
    this._reconciledCache = merge(old, result, _.defaults({
      comparatorId: function (a, b) {
        return a._id === b._id;
      }
    }, self._options));
  }

  if (this._cacheCallback && this._remoteHasChanged) {
    this._cacheCallback(self._reconciledCache);
    this._remoteHasChanged = false;
  }
};

module.exports = HybridObserver;

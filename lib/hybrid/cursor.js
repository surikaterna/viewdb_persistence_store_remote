var Kuery = require('kuery');
var Observe = require('./observe');
var reconcile = require('./reconcile');
var cacheUtils = require('../cacheUtils');

/**
 *
 * @param {*} query Mongodb query, for example: { 'identifiers.identifier': 'abc' }
 * @param {*} local Local cursor
 * @param {*} remote Remote cursor
 * @param {*} findOptions Not in use?
 * @param {*} options Options supplied from collection.
 * @param {*} onCacheUpdateCallback Optional callback used when data is fetched from remote and should be stored.
 * @param {*} cacheCollection Optional collection were cached data is stored.
 */
var HybridCursor = function (query, local, remote, findOptions, options, onCacheUpdateCallback, cacheCollection) {
  this._query = query;
  this._sort = null;
  this._limit = null;
  this._local = local;
  this._remote = remote;
  this._findOptions = findOptions;
  this._options = options;
  this._onCacheUpdateCallback = onCacheUpdateCallback;
  this._cacheCollection = cacheCollection;
};

HybridCursor.prototype._toArray = function (callback) {
  //reconcile strategy
  var self = this;
  var localData = null;
  var remoteData = null;
  var localErr = null;
  var remoteErr = null;
  var kuery = new Kuery(this._query);
  var sort = this._sort;
  var limit = this._limit;

  if (sort) {
    kuery.sort(sort);
  }
  if (limit) {
    kuery.limit(limit);
  }

  function serverResult(err, result) {
    if (err) {
      remoteErr = err;
      result = result || [];
      if (self._options.throwRemoteErr) {
        return callback(err);
      }
    }
    remoteData = result;
    if (localData) {
      var combinedResult = kuery.find(reconcile(localData, remoteData));
      callback(null, combinedResult);
      self._onCacheUpdateCallback(self._query, '', limit, sort || '', combinedResult);
    }
  }

  function localResult(err, result) {
    if (err) {
      localErr = err;
      return callback(err, result);
    }

    localData = result;
    if (remoteData || remoteErr) {
      if (!(remoteErr && self._options.throwRemoteErr)) {
        var combinedResult = kuery.find(reconcile(localData, remoteData || []));
        callback(null, combinedResult);
        self._onCacheUpdateCallback(self._query, '', limit, sort || '', combinedResult);
      }
    } else {
      if (self._options.localFirst) {
        callback(err, localData);
      }
    }
  }

  if (sort) {
    this._local.sort(sort);
    this._remote.sort(sort);
  }
  if (limit) {
    this._local.limit(limit);
    this._remote.limit(limit);
  }

  this._local.toArray(localResult);
  this._remote.toArray(serverResult);
};

HybridCursor.prototype.toArray = function (callback) {
  var self = this;

  if (this._cacheCollection) {
    this._getCachedIds(function (ids) {
      if (ids) {
        self.local._query.query = { _id: { $in: ids } };
        self.local._refresh();
        self.local.toArray(function (cacheError, cachedResults) {
          if (cacheError) {
            callback(cacheError, cachedResults);
          }

          callback(null, cachedResults);
        });
      } else {
        self._toArray(callback);
      }
    });
  } else {
    this._toArray(callback);
  }
};

HybridCursor.prototype._refresh = function () {
  this._remote._refresh();
  this._local._refresh();
};

HybridCursor.prototype.sort = function (sort) {
  this._sort = sort;
  return this;
};

HybridCursor.prototype.limit = function (limit) {
  this._limit = limit;
  return this;
};

HybridCursor.prototype.skip = function (skip) {
  console.warn('skip not supported on hybrid');
  return this;
};

HybridCursor.prototype.updateQuery = function (query) {
  this._local._query.query = query;
  this._remote._query.query = query;
  this._query = query;
  this._refresh();
};

HybridCursor.prototype._getCachedIds = function (callback) {
  var queryHash = cacheUtils.generateQueryHash(this._query, '', this._skip, this._limit | '', this._sort);
  this._cacheCollection.find({ _id: queryHash }).toArray(function (err, result) {
    var hasResult = result && result[0];
    callback(hasResult);
  });
};

HybridCursor.prototype._onObserverCacheUpdate = function (result) {
  this._onCacheUpdateCallback(this._query, '', this._limit, this._sort || '', result);
};

HybridCursor.prototype.observe = function (options) {
  return new Observe(this._local, this._remote, this._options, options, this._onObserverCacheUpdate.bind(this));
};

module.exports = HybridCursor;

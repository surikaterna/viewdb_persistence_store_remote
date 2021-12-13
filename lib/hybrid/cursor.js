var Kuery = require('kuery');
var Observe = require('./observe');
var reconcile = require('./reconcile');
var _ = require('lodash');
var TimeTracker = require('./timeTracker');

var LoggerFactory = require('slf').LoggerFactory;
var LOG = LoggerFactory.getLogger('lx:viewdb-persistence-store-remote');
/**
 *
 * @param {*} query Mongodb query, for example: { 'identifiers.identifier': 'abc' }
 * @param {*} local Local cursor
 * @param {*} remote Remote cursor
 * @param {*} findOptions Not in use?
 * @param {*} options Options supplied from collection.
 */
var HybridCursor = function (query, local, remote, findOptions, options) {
  this._query = query;
  this._sort = null;
  this._limit = null;
  this._skip = 0;
  this._local = local;
  this._remote = remote;
  this._findOptions = findOptions;
  this._options = options;
  this._onCacheUpdateCallback = options.onCacheUpdateCallback;
  this._getCachedData = options.getCachedData;
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
  var skip = this._skip;
  var project = this._project;

  if (sort) {
    kuery.sort(sort);
  }
  if (limit) {
    kuery.limit(limit);
  }
  if (skip) {
    kuery.skip(skip);
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
      if (_.isFunction(self._onCacheUpdateCallback)) {
        self._onCacheUpdateCallback(self._query, skip, limit, sort, project, combinedResult);
      }
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
        if (_.isFunction(self._onCacheUpdateCallback)) {
          self._onCacheUpdateCallback(self._query, skip, limit, sort, project, combinedResult);
        }
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
  if (skip) {
    this._local.skip(skip);
    this._remote.skip(skip);
  }
  if (project && _.isFunction(this._remote.project)) {
    this._remote.project(project);
  }

  this._local.toArray(localResult);
  this._remote.toArray(serverResult);
};

HybridCursor.prototype.toArray = function (callback) {
  var self = this;
  var timeTracker = new TimeTracker();
  var wrappedCallback = callback;

  if (this._options.loggingEnabled) {
    wrappedCallback = function () {
      timeTracker.stop();
      var queryTime = timeTracker.getExecutionTime();
      if (queryTime > self._options.queryMaxTime) {
        LOG.warn('Query %j, took longer than allowed max time of %s seconds.', self._query, self._options.queryMaxTime);
      }

      return callback.apply(self, arguments);
    };
  }
  timeTracker.start();
  if (this._options.cacheQueries && this._getCachedData) {
    this._getCachedData(this._query, this._skip, this._limit, this._sort, this._project, function (err, data) {
      if (data) {
        wrappedCallback(null, data);
        return;
      }

      self._toArray(wrappedCallback);
    });
  } else {
    this._toArray(wrappedCallback);
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
  this._skip = skip;
  return this;
};

HybridCursor.prototype.updateQuery = function (query) {
  this._local._query.query = query;
  this._remote._query.query = query;
  this._query = query;
  this._refresh();
};

HybridCursor.prototype._onObserverCacheUpdate = function (result) {
  if (_.isFunction(this._onCacheUpdateCallback)) {
    this._onCacheUpdateCallback(this._query, this._skip, this._limit, this._sort, this._project, result);
  }
};

HybridCursor.prototype._getObserverData = function (callback) {
  this._getCachedData(this._query, this._skip, this._limit, this._sort, this._project, callback);
};

HybridCursor.prototype._count = function (options, callback) {
  var self = this;
  var localCount = null;
  var remoteCount = null;

  var timeTracker = new TimeTracker();
  var wrappedCallback = callback;

  if (this._options.loggingEnabled) {
    wrappedCallback = function () {
      timeTracker.stop();
      var queryTime = timeTracker.getExecutionTime();
      if (queryTime > self._options.queryMaxTime) {
        LOG.warn('Count query %j, took longer than allowed max time of %s seconds.', self._query, self._options.queryMaxTime);
      }

      return callback.apply(self, arguments);
    };
  }

  timeTracker.start();

  function serverResult(err, count) {
    if (err) {
      return wrappedCallback(err);
    }
    remoteCount = count;
    return wrappedCallback(null, count);
  }

  function localResult(err, count) {
    if (err) {
      return wrappedCallback(err, count);
    }

    localCount = count;
    if (remoteCount) {
      wrappedCallback(null, remoteCount);
    } else {
      if (self._options.localFirst) {
        wrappedCallback(err, localCount);
      }
    }
  }

  this._local.count(options, localResult);
  this._remote.count(options, serverResult);
};

HybridCursor.prototype.count = function (options, callback) {
  var self = this;
  if (_.isFunction(options)) {
    callback = options;
    options = undefined;
  }

  if (this._getCachedData) {
    this._getCachedData(this._query, this._skip, this._limit, this._sort, this._project, function (err, data) {
      if (data) {
        callback(null, data.length);
        return;
      }

      self._count(options, callback);
    });
  } else {
    this._count(options, callback);
  }
};

HybridCursor.prototype.observe = function (options) {
  var sort = this._sort;
  var limit = this._limit;
  var skip = this._skip;

  if (sort) {
    this._local.sort(sort);
    this._remote.sort(sort);
  }
  if (limit) {
    this._local.limit(limit);
    this._remote.limit(limit);
  }
  if (skip) {
    this._local.skip(skip);
    this._remote.skip(skip);
  }
  if (this._project && _.isFunction(this._remote.project)) {
    this._remote.project(this._project);
  }

  var modifiedOptions = options;
  if (this._options.cacheQueries) {
    modifiedOptions = Object.assign({}, options, { cacheCallback: this._onObserverCacheUpdate.bind(this), getCache: this._getObserverData.bind(this) });
  }

  return new Observe(this._local, this._remote, this._options, modifiedOptions);
};

HybridCursor.prototype.project = function (project) {
  this._project = project;
  return this;
};

module.exports = HybridCursor;

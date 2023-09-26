var _ = require('lodash');
var HybridCursor = require('./cursor');
var cacheUtils = require('../cacheUtils');

var HybridCollection = function (local, remote, name, options, cacheCollection, projectedDocumentCollection) {
  this._local = local;
  this._remote = remote;
  this._name = name;
  this._options = options;
  this._cacheCollection = cacheCollection;
  this._projectedDocumentCollection = projectedDocumentCollection;
};

HybridCollection.prototype.find = function (query, options) {
  return new HybridCursor(
    query,
    this._local.find(query, options),
    this._remote.find(query, options),
    options,
    Object.assign({}, this._options, { onCacheUpdateCallback: this._cacheQuery.bind(this), getCachedData: this._getCachedData.bind(this) })
  );
};

HybridCollection.prototype.save = function (doc, callback) {
  if (this._options.syncWrites) {
    this._remote.save(doc, callback);
  }
  return this._local.save(doc, callback);
};

HybridCollection.prototype.insert = function (doc, callback) {
  var self = this;
  return this._local.insert(doc, function (err, result) {
    if (self._options.syncWrites) {
      self._remote.insert(doc, callback);
    }
    if (callback) {
      callback(err, result);
    }
  });
};

HybridCollection.prototype.remove = function (query, options, callback) {
  var self = this;
  return this._local.remove(query, options, function (err, result) {
    if (self._options.syncWrites) {
      self._remote.remove(query, options);
    }
    if (callback) {
      callback(err, result);
    }
  });
};

HybridCollection.prototype._cacheQuery = function (query, skip, limit, sort, project, documents) {
  var self = this;

  if (!this._options.cacheQueries) {
    return;
  }

  var cachedDateTime = new Date().getTime();
  var documentIds = [];
  _.forEach(documents, function (document) {
    documentIds.push(document._id);

    var isProjected = !_.isEmpty(project);
    var collection = self._local;
    if (isProjected) {
      collection = self._projectedDocumentCollection;
    }

    collection.save(Object.assign({}, document, { _insertedAt: cachedDateTime }), { skipVersioning: true, skipTimestamp: true });
  });

  var queryHash = cacheUtils.generateQueryHash(query, this._name, skip, limit, sort, project);
  this._cacheCollection.save({ _id: queryHash, createDateTime: cachedDateTime, resultSet: documentIds }, { skipVersioning: true, skipTimestamp: true });
};

HybridCollection.prototype._getCachedData = function (query, skip, limit, sort, project, callback) {
  var self = this;
  this._getCachedIds(query, skip, limit, sort, function (ids) {
    if (!ids) {
      callback(undefined);
      return;
    }

    var collection = self._local;
    var isProjected = !_.isEmpty(project);
    if (isProjected) {
      collection = self._projectedDocumentCollection;
    }

    collection.find({ _id: { $in: ids } }).toArray(function (cacheError, cachedResults) {
      if (cacheError) {
        callback(cacheError, cachedResults);
      }

      if (ids.length !== cachedResults.length) {
        callback(null);
        return;
      }

      callback(null, cachedResults);
    });
  });
};

HybridCollection.prototype._getCachedIds = function (query, skip, limit, sort, callback) {
  if (!this._cacheCollection || !this._options.cacheLifeTime) {
    callback(undefined);
    return;
  }

  var queryHash = cacheUtils.generateQueryHash(query, this._name, skip, limit, sort);
  var minimumChangeDateTime = new Date();
  minimumChangeDateTime.setMinutes(minimumChangeDateTime.getMinutes() - this._options.cacheLifeTime);
  var minTimeEpoch = minimumChangeDateTime.getTime();

  this._cacheCollection.find({ _id: queryHash, createDateTime: { $gt: minTimeEpoch } }).toArray(function (err, result) {
    var hasResult = result && result[0];

    if (!hasResult) {
      callback(undefined);
      return;
    }
    callback(result[0].resultSet);
  });
};

module.exports = HybridCollection;

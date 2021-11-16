var _ = require('lodash');
var HybridCursor = require('./cursor');
var cacheUtils = require('../cacheUtils');

var HybridCollection = function (local, remote, name, options, cacheCollection) {
	this._local = local;
	this._remote = remote;
	this._name = name;
	this._options = options;
	this._cacheCollection = cacheCollection;
};

HybridCollection.prototype.find = function(query, options) {
	return new HybridCursor(
    query,
    this._local.find(query, options),
    this._remote.find(query, options),
		options,
    this._options,
    this._cacheQuery.bind(this),
    this._getCachedData.bind(this)
  );
};

HybridCollection.prototype.save = function(doc, callback) {
	if(this._options.syncWrites) {
		this._remote.save(doc, callback);
	}
	return this._local.save(doc, callback);
};

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
};

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
};

HybridCollection.prototype._cacheQuery = function (query, skip, limit, sort, documents) {
  var self = this;

  if (!this._options.cacheQueries) {
    return;
  }

  var cachedDateTime = new Date().getTime();
  var documentIds = [];
  _.forEach(documents, function (document) {
    documentIds.push(document._id);
    self._local.save(Object.assign({}, document, { _insertedAt: cachedDateTime }), { skipVersioning: true, skipTimestamp: true });
  });

  var queryHash = cacheUtils.generateQueryHash(query, this._name, skip, limit, sort);
  this._cacheCollection.save({ _id: queryHash, createDateTime: cachedDateTime, resultSet: documentIds }, { skipVersioning: true, skipTimestamp: true });
};

HybridCollection.prototype._getCachedData = function (query, skip, limit, sort, callback) {
  var self = this;
  this._getCachedIds(query, skip, limit, sort, function (ids) {
    if (!ids) {
      callback(undefined);
      return;
    }

    self._local
      .find({ _id: { $in: ids } })
      .toArray(function (cacheError, cachedResults) {
        if (cacheError) {
          callback(cacheError, cachedResults);
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
  minimumChangeDateTime.setMinutes(
    minimumChangeDateTime.getMinutes() - this._options.cacheLifeTime
  );
  var minTimeEpoch = minimumChangeDateTime.getTime();

  this._cacheCollection
    .find({ _id: queryHash, createDateTime: { $gt: minTimeEpoch } })
    .toArray(function (err, result) {
      var hasResult = result && result[0];

      if (!hasResult) {
        callback(undefined);
        return;
      }
      callback(result[0].resultSet);
    });
};

module.exports = HybridCollection;

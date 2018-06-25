var Kuery = require('kuery');

var Observe = require('./observe');

var reconcile = require('./reconcile');
var HybridCursor = function (query, local, remote, findOptions, options) {
  this._query = query;
  this._sort, this._limit, this._skip;
  this._kuery = new Kuery(this._query);
  this._local = local;
  this._remote = remote;
  this._findOptions = findOptions;
  this._options = options;
}

HybridCursor.prototype.toArray = function (callback) {
  //reconcile strategy
  var self = this;
  var localData = null;
  var remoteData = null;
  var localErr = null;
  var remoteErr = null;
  var kuery = new Kuery(this._query);
  var sort = this._sort;
  var limit = this._limit;
  // var skip = this._skip;
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
      callback(null, kuery.find(reconcile(localData, remoteData)));
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
        callback(null, kuery.find(reconcile(localData, remoteData || [])));
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
  // if (skip) { not supported
  // 	this._local.skip(skip);
  // 	this._remote.skip(skip);
  // }
  this._local.toArray(localResult);
  this._remote.toArray(serverResult);
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
  // this._skip = skip;
  console.warn('skip not supported on hybrid');
  return this;
};

HybridCursor.prototype.updateQuery = function (query) {
  this._local._query.query = query;
  this._remote._query.query = query;
  this._query = query;
  this._kuery = new Kuery(this._query);
  this._refresh();
};

HybridCursor.prototype.observe = function (options) {
  return new Observe(this._local, this._remote, this._options, options);
}

module.exports = HybridCursor;
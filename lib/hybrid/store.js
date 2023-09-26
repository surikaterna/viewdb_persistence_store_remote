var _ = require('lodash');
var Promise = require('bluebird');
var Collection = require('./collection');

var defaultOptions = {
  syncWrites: false, // if local writes should be sent over the wire to remote
  cacheReads: true, // when reading remote documents should they be stored in the local db
  localFirst: true, // when reading documents should we return the locally cached ones first and then the remote ones when they arrive
  throwRemoteErr: false, // if remote throws should we swallow them or throw them to client
  throttleObserveRefresh: 200,
  cacheLifeTime: 2, // Time in minutes that the cache should be alive
  cacheQueries: false,
  localOnlyCollections: new Set(),
  cacheCollectionName: '_cache',
  projectedDocumentsCollection: '_projected_cache'
};

var HybridStore = function (local, remote, options) {
  this._local = local;
  this._remote = remote;
  this._options = _.defaults(options || {}, defaultOptions);
  this._collections = {};

  if (this._options.cacheQueries) {
    this._collections[this._options.cacheCollectionName] = local.collection(this._options.cacheCollectionName);
    this._collections[this._options.projectedDocumentsCollection] = local.collection(this._options.projectedDocumentsCollection);
    setInterval(this._cleanCachedData.bind(this), 1000 * 60 * 30); // Clean every 30 minutes
  }
};

HybridStore.prototype.open = function () {
  var self = this;
  var storesToOpen = [];
  if (this._local.open) {
    storesToOpen.push(this._local.open());
  }
  if (this._remote.open) {
    storesToOpen.push(this._remote.open());
  }

  return Promise.all(storesToOpen).then(function () {
    return self;
  });
};

HybridStore.prototype.collection = function (name, callback) {
  var collection = this._collections[name];
  if (!collection) {
    var local = this._local.collection(name);

    if (this._options.localOnlyCollections.has(name)) {
      this._collections[name] = local;
    } else {
      var remote = this._remote.collection(name);
      this._collections[name] = new Collection(
        local,
        remote,
        name,
        this._options,
        this._collections[this._options.cacheCollectionName],
        this._collections[this._options.projectedDocumentsCollection]
      );
    }

    collection = this._collections[name];
  }
  if (callback) {
    callback(collection);
  }
  return collection;
};

HybridStore.prototype._cleanCachedData = function () {
  var self = this;
  var minimumChangeDateTime = new Date();
  minimumChangeDateTime.setMinutes(minimumChangeDateTime.getMinutes() - this._options.cacheLifeTime);
  var maxTimeEpoch = minimumChangeDateTime.getTime();

  // Clean cached query first to prevent query not pointing at anything
  this._cleanCollection(this._collections[this._options.cacheCollectionName], maxTimeEpoch, 'createDateTime');

  _.forEach(this._collections, function (collection, collectionName) {
    if (collectionName === self._options.cacheCollectionName) {
      return;
    }

    self._cleanCollection(collection._local || collection, maxTimeEpoch);
  });
};

HybridStore.prototype._cleanCollection = function (collection, maxEpoch, propertyName) {
  var comparisonPropertyName = propertyName || '_insertedAt';
  collection.remove({ [comparisonPropertyName]: { $lt: maxEpoch } }, null, function () {});
};

module.exports = HybridStore;

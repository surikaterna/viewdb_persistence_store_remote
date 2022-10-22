import { defaults, forEach } from 'lodash';
import Promise from 'bluebird';
import Collection from './collection';

const defaultOptions = {
  // if local writes should be sent over the wire to remote
  syncWrites: false,
  // when reading remote documents should they be stored in the local db
  cacheReads: true,
  // when reading documents should we return the locally cached ones first and then the remote ones when they arrive
  localFirst: true,
  // if remote throws should we swallow them or throw them to client
  throwRemoteErr: false,
  throttleObserveRefresh: 200,
  // Time in minutes that the cache should be alive
  cacheLifeTime: 2,
  cacheQueries: false,
  localOnlyCollections: new Set(),
  cacheCollectionName: '_cache',
  projectedDocumentsCollection: '_projected_cache'
};

export default class HybridStore {
  constructor(local, remote, options) {
    this._local = local;
    this._remote = remote;
    this._options = defaults(options || {}, defaultOptions);
    this._collections = {};

    if (this._options.cacheQueries) {
      this._collections[this._options.cacheCollectionName] = local.collection(
        this._options.cacheCollectionName
      );
      this._collections[this._options.projectedDocumentsCollection] = local.collection(this._options.projectedDocumentsCollection);
      setInterval(this._cleanCachedData, 1000 * 60 * 30); // Clean every 30 minutes
    }
  }

  open() {
    const storesToOpen = [];

    if (this._local.open) {
      storesToOpen.push(this._local.open());
    }

    if (this._remote.open) {
      storesToOpen.push(this._remote.open());
    }

    return Promise.all(storesToOpen).then(() => this);
  }

  collection(name, callback) {
    let collection = this._collections[name];

    if (!collection) {
      const local = this._local.collection(name);

      if (this._options.localOnlyCollections.has(name)) {
        this._collections[name] = local;
      } else {
        const remote = this._remote.collection(name);
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
  }

  _cleanCachedData = () => {
    const minimumChangeDateTime = new Date();
    minimumChangeDateTime.setMinutes(
      minimumChangeDateTime.getMinutes() - this._options.cacheLifeTime
    );
    const maxTimeEpoch = minimumChangeDateTime.getTime();

    // Clean cached query first to prevent query not pointing at anything
    this._cleanCollection(
      this._collections[this._options.cacheCollectionName],
      maxTimeEpoch,
      'createDateTime'
    );

    forEach(this._collections, (collection, collectionName) => {
      if (collectionName === this._options.cacheCollectionName) {
        return;
      }

      this._cleanCollection(collection._local || collection, maxTimeEpoch);
    });
  }

  _cleanCollection(collection, maxEpoch, propertyName) {
    const comparisonPropertyName = propertyName || '_insertedAt';
    collection.remove({ [comparisonPropertyName]: { $lt: maxEpoch } }, null, () => {});
  }
}

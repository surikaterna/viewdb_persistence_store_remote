import { defaults, filter, includes, isEmpty, throttle } from 'lodash';
import reconcile from './reconcile';
import { merge } from 'viewdb';

function pushArray(arr, arr2) {
  arr.push.apply(arr, arr2);
}

function buildOptions(cache, callback, removed, isRemote) {
  return {
    init: (result) => {
      if (isEmpty(cache)) {
        pushArray(cache, result);
      } else {
        // if array is empty init is called a second time - reuse reconcile logic.
        cache.length = 0;
        pushArray(cache, result);
      }
      callback(result);
    },
    added: (e, index) => {
      cache.splice(index, 0, e);

      if (isRemote && removed.length > 0) {
        removed = [];
      }

      callback(e);
    },
    removed: (e, index) => {
      cache.splice(index, 1);

      if (removed && !isRemote) {
        removed.push(e._id);
      }

      if (isRemote && removed.length > 0) {
        removed = [];
      }

      callback(e);
    },
    changed: (asis, tobe, index) => {
      cache[index] = tobe;

      if (isRemote && removed.length > 0) {
        removed = [];
      }

      callback(tobe);
    },
    moved: (e, oldIndex, newIndex) => {
      cache.splice(oldIndex, 1);
      cache.splice(newIndex, 0, e);

      if (isRemote && removed.length > 0) {
        removed = [];
      }

      callback(e);
    }
  }
}

export default class HybridObserver {
  /**
   * @param {*} localCursor Local cursor
   * @param {*} remoteCursor Remote cursor
   * @param {object} collectionOptions Options supplied from collection
   * @param {object} options Options to callback on data change
   */
  constructor(localCursor, remoteCursor, collectionOptions, options) {
    this._initialized = false;
    this._localCursor = localCursor;
    this._remoteCursor = remoteCursor;
    this._options = options;
    this._cacheCallback = options.cacheCallback;
    this._getCache = options.getCache;

    this._localCache = [];
    this._remoteCache = [];
    this._removed = [];
    this._reconciledCache = [];

    // make sure refresh is only called once every x ms
    const _refresh = throttle(this.refresh, collectionOptions.throttleObserveRefresh);
    const remoteOptions = buildOptions(this._remoteCache, _refresh, this._removed, true);

    if (!this._getCache) {
      this._localHandle = this._localCursor.observe(buildOptions(this._localCache, _refresh, this._removed, false));
      this._remoteHandle = this._remoteCursor.observe(remoteOptions);
    } else {
      this._getCache((err, data) => {
        if (data) {
          this._remoteCache.concat(data);
          this.refresh();
          delete remoteOptions.init;
        }
        this._remoteHandle = this._remoteCursor.observe(remoteOptions);
      });

      const cacheUpdater = () => {
        this._cacheCallback(this._remoteCache);
      };

      // While the observer is running, keep the cached data alive
      this._cacheUpdaterInterval = setInterval(cacheUpdater, 1000 * 60 * Math.max(collectionOptions.cacheLifeTime / 2, 1));
    }
  }

  stop() {
    this._localHandle && this._localHandle.stop();
    this._remoteHandle.stop();
    clearInterval(this._cacheUpdaterInterval);
  }

  refresh = () => {
    let remoteCache = this._remoteCache;
    if (this._removed.length > 0) {
      remoteCache = filter(this._remoteCache, (doc) => !includes(this._removed, doc._id));
    }

    const result = reconcile(this._localCache, remoteCache);

    if (!this._initialized && this._options.init) {
      this._initialized = true;
      this._reconciledCache = result;
      this._options.init(result);
    } else {
      const old = this._reconciledCache;
      this._reconciledCache = merge(old, result, defaults({
        comparatorId: (a, b) => a._id === b._id
      }, this._options));
    }

    if (this._cacheCallback && this._getCache) {
      this._cacheCallback(remoteCache);
    }
  };
}

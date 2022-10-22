import Kuery from 'kuery';
import Observe from './observe';
import reconcile from './reconcile';
import { isFunction } from 'lodash';
import TimeTracker from './timeTracker';
import { LoggerFactory } from 'slf';

const LOG = LoggerFactory.getLogger('viewdb:persistence-store:remote:hybrid-cursor');

export default class HybridCursor {
  /**
   *
   * @param {*} query Mongodb query, for example: { 'identifiers.identifier': 'abc' }
   * @param {*} local Local cursor
   * @param {*} remote Remote cursor
   * @param {*} findOptions Not in use?
   * @param {*} options Options supplied from collection.
   */
  constructor(query, local, remote, findOptions, options) {
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
  }

  toArray(callback) {
    const timeTracker = new TimeTracker();
    let wrappedCallback = callback;

    if (this._options.loggingEnabled) {
      wrappedCallback = () => {
        timeTracker.stop();
        const queryTime = timeTracker.getExecutionTime();
        if (queryTime > this._options.queryMaxTime) {
          LOG.warn('Query %j, took longer than allowed max time of %s seconds.', this._query, this._options.queryMaxTime);
        }

        return callback.apply(this, arguments);
      };
    }

    timeTracker.start();
    if (this._options.cacheQueries && this._getCachedData) {
      this._getCachedData(this._query, this._skip, this._limit, this._sort, this._project, (err, data) => {
        if (data) {
          wrappedCallback(null, data);
          return;
        }

        this._toArray(wrappedCallback);
      });
    } else {
      this._toArray(wrappedCallback);
    }
  }

  _toArray(callback) {
    //reconcile strategy
    let localData = null;
    let remoteData = null;
    let localErr = null;
    let remoteErr = null;
    const kuery = new Kuery(this._query);
    const sort = this._sort;
    const limit = this._limit;
    const skip = this._skip;
    const project = this._project;

    if (sort) {
      kuery.sort(sort);
    }
    if (limit) {
      kuery.limit(limit);
    }
    if (skip) {
      kuery.skip(skip);
    }

    const serverResult = (err, result) => {
      if (err) {
        remoteErr = err;
        result = result || [];

        if (this._options.throwRemoteErr) {
          return callback(err);
        }
      }

      remoteData = result;

      if (localData) {
        const combinedResult = kuery.find(reconcile(localData, remoteData));
        callback(null, combinedResult);
        if (isFunction(this._onCacheUpdateCallback)) {
          this._onCacheUpdateCallback(this._query, skip, limit, sort, project, combinedResult);
        }
      }
    };

    const localResult = (err, result) => {
      if (err) {
        localErr = err;
        return callback(err, result);
      }

      localData = result;

      if (remoteData || remoteErr) {
        if (!(remoteErr && this._options.throwRemoteErr)) {
          const combinedResult = kuery.find(reconcile(localData, remoteData || []));
          callback(null, combinedResult);

          if (isFunction(this._onCacheUpdateCallback)) {
            this._onCacheUpdateCallback(this._query, skip, limit, sort, project, combinedResult);
          }
        }
      } else {
        if (this._options.localFirst) {
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

    if (project && isFunction(this._remote.project)) {
      this._remote.project(project);
    }

    this._local.toArray(localResult);
    this._remote.toArray(serverResult);
  }

  sort(sort) {
    this._sort = sort;
    return this;
  }

  limit(limit) {
    this._limit = limit;
    return this;
  }

  skip(skip) {
    this._skip = skip;
    return this;
  }

  project(project) {
    this._project = project;
    return this;
  }

  observe(options) {
    const sort = this._sort;
    const limit = this._limit;
    const skip = this._skip;

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

    if (this._project && isFunction(this._remote.project)) {
      this._remote.project(this._project);
    }

    let modifiedOptions = options;
    if (this._options.cacheQueries) {
      modifiedOptions = Object.assign({}, options, { cacheCallback: this._onObserverCacheUpdate, getCache: this._getObserverData });
    }

    return new Observe(this._local, this._remote, this._options, modifiedOptions);
  }

  _onObserverCacheUpdate = (result) => {
    if (isFunction(this._onCacheUpdateCallback)) {
      this._onCacheUpdateCallback(this._query, this._skip, this._limit, this._sort, this._project, result);
    }
  };

  _getObserverData = (callback) => {
    this._getCachedData(this._query, this._skip, this._limit, this._sort, this._project, callback);
  }

  count(options, callback) {
    if (isFunction(options)) {
      callback = options;
      options = undefined;
    }

    if (this._getCachedData) {
      this._getCachedData(this._query, this._skip, this._limit, this._sort, this._project, (err, data) => {
        if (data) {
          callback(null, data.length);
          return;
        }

        this._count(options, callback);
      });
    } else {
      this._count(options, callback);
    }
  }

  _count(options, callback) {
    let localCount = null;
    let remoteCount = null;

    const timeTracker = new TimeTracker();
    let wrappedCallback = callback;

    if (this._options.loggingEnabled) {
      wrappedCallback = () => {
        timeTracker.stop();
        const queryTime = timeTracker.getExecutionTime();

        if (queryTime > this._options.queryMaxTime) {
          LOG.warn('Count query %j, took longer than allowed max time of %s seconds.', this._query, this._options.queryMaxTime);
        }

        return callback.apply(self, arguments);
      };
    }

    timeTracker.start();

    const serverResult = (err, count) => {
      if (err) {
        return wrappedCallback(err);
      }

      remoteCount = count;
      return wrappedCallback(null, count);
    };

    const localResult = (err, count) => {
      if (err) {
        return wrappedCallback(err, count);
      }

      localCount = count;

      if (remoteCount) {
        wrappedCallback(null, remoteCount);
      } else {
        if (this._options.localFirst) {
          wrappedCallback(err, localCount);
        }
      }
    };

    this._local.count(options, localResult);
    this._remote.count(options, serverResult);
  }

  updateQuery(query) {
    this._local._query.query = query;
    this._remote._query.query = query;
    this._query = query;
    this._refresh();
  }

  _refresh() {
    this._remote._refresh();
    this._local._refresh();
  }
}

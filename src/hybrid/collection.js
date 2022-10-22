import { forEach, isEmpty } from 'lodash';
import HybridCursor from './cursor';
import { generateQueryHash } from '../cacheUtils';

export default class HybridCollection {
  constructor(local, remote, name, options, cacheCollection, projectedDocumentCollection) {
    this._local = local;
    this._remote = remote;
    this._name = name;
    this._options = options;
    this._cacheCollection = cacheCollection;
    this._projectedDocumentCollection = projectedDocumentCollection;
  }

  find(query, options) {
    return new HybridCursor(
      query,
      this._local.find(query, options),
      this._remote.find(query, options),
      options,
      Object.assign({}, this._options, { onCacheUpdateCallback: this._cacheQuery, getCachedData: this._getCachedData })
    );
  }

  _cacheQuery = (query, skip, limit, sort, project, documents) => {
    if (!this._options.cacheQueries) {
      return;
    }

    const cachedDateTime = new Date().getTime();
    const documentIds = [];
    forEach(documents, (document) => {
      documentIds.push(document._id);

      const isProjected = !isEmpty(project);
      let collection = this._local;

      if (isProjected) {
        collection = this._projectedDocumentCollection;
      }

      collection.save(Object.assign({}, document, { _insertedAt: cachedDateTime }), {
        skipVersioning: true,
        skipTimestamp: true
      });
    });

    const queryHash = generateQueryHash(query, this._name, skip, limit, sort, project);

    this._cacheCollection.save({
      _id: queryHash,
      createDateTime: cachedDateTime,
      resultSet: documentIds
    }, { skipVersioning: true, skipTimestamp: true });
  }

  _getCachedData = (query, skip, limit, sort, project, callback) => {
    this._getCachedIds(query, skip, limit, sort, (ids) => {
      if (!ids) {
        callback(undefined);
        return;
      }

      let collection = this._local;
      const isProjected = !isEmpty(project);

      if (isProjected) {
        collection = this._projectedDocumentCollection;
      }

      collection
        .find({ _id: { $in: ids } })
        .toArray((cacheError, cachedResults) => {
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

  save(doc, callback) {
    if (this._options.syncWrites) {
      this._remote.save(doc, callback);
    }

    return this._local.save(doc, callback);
  }

  insert(doc, callback) {
    return this._local.insert(doc, (err, result) => {
      if (this._options.syncWrites) {
        this._remote.insert(doc, callback);
      }

      if (callback) {
        callback(err, result);
      }
    });
  }

  remove(query, options, callback) {
    return this._local.remove(query, options, (err, result) => {
      if (this._options.syncWrites) {
        this._remote.remove(query, options);
      }

      if (callback) {
        callback(err, result);
      }
    });
  }

  _getCachedIds(query, skip, limit, sort, callback) {
    if (!this._cacheCollection || !this._options.cacheLifeTime) {
      callback(undefined);
      return;
    }

    const queryHash = generateQueryHash(query, this._name, skip, limit, sort);
    const minimumChangeDateTime = new Date();
    minimumChangeDateTime.setMinutes(
      minimumChangeDateTime.getMinutes() - this._options.cacheLifeTime
    );
    const minTimeEpoch = minimumChangeDateTime.getTime();

    this._cacheCollection
      .find({ _id: queryHash, createDateTime: { $gt: minTimeEpoch } })
      .toArray((err, result) => {
        const hasResult = result && result[0];

        if (!hasResult) {
          callback(undefined);
          return;
        }

        callback(result[0].resultSet);
      });
  }
}

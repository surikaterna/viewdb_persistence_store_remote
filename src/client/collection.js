/* eslint-disable no-param-reassign */
import { isFunction } from 'lodash';
import Cursor from './cursor';
import { EventEmitter } from 'events';
import { v4 as uuid } from 'node-uuid';

export default class Collection extends EventEmitter {
  static Cursor = Cursor;

  constructor(client, collectionName) {
    super();
    this._client = client;
    this._name = collectionName;
  }

  find(query, options) {
    if (this._isIdentityQuery(query)) {
      return [];
    }

    return new Cursor(this, { query }, options, this._getDocuments);
  }

  count(query, options, callback) {
    if (isFunction(query)) {
      callback = query;
      query = {};
    }

    if (isFunction(options)) {
      callback = options;
      options = {};
    }

    const params = {
      id: uuid(),
      count: query,
      collection: this._name
    };

    if (options) {
      if (options.limit) {
        params.limit = options.limit;
      }

      if (options.skip) {
        params.skip = options.skip;
      }
    }

    this._client.request(params, (err, result) => {
      callback(err, result);
    });
  }

  insert() {
    throw new Error('Not implemented');
  }

  save() {
    throw new Error('Not implemented');
  }

  remove() {
    throw new Error('Not implemented');
  }

  _getDocuments = (query, callback) => {
    const params = this._buildParams(query);
    this._client.request(params, (err, res) => {
      if (err) {
        callback(err);
      } else {
        callback(null, res);
      }
    });
  };

  _buildParams(query, method) {
    const q = query.query || query;
    const params = {
      collection: this._name,
      find: q
    };

    if (query.query) {
      params.skip = query.skip;
      params.limit = query.limit;
      params.sort = query.sort;

      if (query.project) {
        params.project = query.project;
      }
    }

    if (method) {
      params.method = method;
    }

    return params;
  }

  _isIdentityQuery() {
    return false;
  }
}

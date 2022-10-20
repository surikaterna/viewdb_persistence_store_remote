/* eslint-disable no-param-reassign */
import { v4 as uuid } from 'node-uuid';
import { get, isFunction } from 'lodash';
import { Cursor } from 'viewdb';
import Observer from './observe';
import { LoggerFactory } from 'slf';

const LOG = LoggerFactory.getLogger('lx:viewdb-persistence-store-remote');

export default class RemoteCursor extends Cursor {
  constructor(collection, query, options, getDocuments) {
    super(collection, query, options, getDocuments);
  }

  count(applySkipLimit, options, callback) {
    if (isFunction(applySkipLimit)) {
      callback = applySkipLimit;
      applySkipLimit = true;
    }
    if (isFunction(options)) {
      callback = options;
      options = {};
    }

    const skip = get(this, '_query.skip', get(options, 'skip', 0));
    const limit = get(this, '_query.limit', get(options, 'limit', 0));

    const params = {
      id: uuid(),
      count: this._query.query || this._query,
      collection: this._collection._name
    };

    if (applySkipLimit) {
      params.skip = skip;
      params.limit = limit;
    }

    this._collection._client.request(params, (err, result) => {
      callback(err, result);
    });
  }

  sort(params) {
    this._query.sort = params;
    this._refresh();
    return this;
  }

  project(params) {
    this._query.project = params;
    return this;
  }

  _refresh() {
    this._collection.emit('change');
  }

  observe(options) {
    if (this._isObserving) {
      LOG.error('Already observing this cursor. Collection: %s - Query: %j', get(this, '_collection._name'), this._query);
      throw new Error(`Already observing this cursor. Collection: ${get(this, '_collection._name')}`);
    }
    this._isObserving = true;

    const refreshListener = () => {
      LOG.info('restarting observer due to change');
      this._handle.stop();
      this._handle = new Observer(this._collection, options, this._query);
    };

    this._collection.on('change', refreshListener);
    this._handle = new Observer(this._collection, options, this._query);

    return {
      stop: () => {
        this._handle.stop();
        this._collection.removeListener('change', refreshListener);
      }
    };
  }
}

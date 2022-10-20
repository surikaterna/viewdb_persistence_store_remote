import { defaults, forEach, isNil, remove } from 'lodash';
import { LoggerFactory } from 'slf';
import { v4 as uuid } from 'node-uuid';

const LOG = LoggerFactory.getLogger('lx:viewdb-persistence-store-remote');

function buildParams(defaultsOptions, query, collection) {
  const options = {
    id: uuid(),
    observe: query.query ?? query,
    collection: collection._name,
  };

  if (query.query) {
    options.skip = query.skip;
    options.limit = query.limit;
    options.sort = query.sort;

    if (query.project) {
      options.project = query.project;
    }
  }

  return defaults(options, defaultsOptions);
}

export default class Observer {
  constructor(collection, options, query) {
    this._collection = collection;
    this._options = options;
    this._remoteHandle = null;
    this._handles = [];
    const events = {
      i: !isNil(options.init),
      a: !isNil(options.added),
      r: !isNil(options.removed),
      c: !isNil(options.changed),
      m: !isNil(options.moved)
    }

    this._params = buildParams({ events }, query, collection);
    this._startObserver();
  }

  _startObserver() {
    this._handle = this._collection._client.subscribe(this._params, (err, result) => {
      if (err) {
        this._handle.stop();
        this._startObserver();
        return;
      }

      if (this._remoteHandle ?? result.handle) {
        this._remoteHandle = result.handle ?? this._remoteHandle;

        if (this._handles.indexOf(this._params.id) > -1) {
          this._collection._client.request({ 'observe.stop': { h: this._params.id } });
          this._handle.stop();
          remove(this._handles, this._params.id);
        } else {
          forEach(result.changes, (c) => {
            if (c.i) { // init
              this._options.init(c.i.r);
            } else if (c.a) { // added
              this._options.added(c.a.e, c.a.i);
            } else if (c.r) { // removed
              this._options.removed(c.r.e, c.r.i);
            } else if (c.c) { // changed
              this._options.changed(c.c.o, c.c.n, c.c.i);
            } else if (c.m) { // moved
              this._options.moved(c.m.e, c.m.o, c.m.n);
            }
          });
        }
      }
    });
  }

  stop() {
    if (!this._remoteHandle) {
      LOG.warn('WARN unsubscribing before receiving subscription handle from server');
      this._handles.push(this._params.id);
    } else {
      this._collection._client.request({ 'observe.stop': { h: this._params.id } });
      this._handle.stop();
    }
  }
}

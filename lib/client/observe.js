var _ = require('lodash');
var Logger = require('slf').Logger;
var LOG = Logger.getLogger('lx:viewdb-persistence-store-remote');
var uuid = require('node-uuid').v4;

var buildParams = function (defaults, query, collection) {
  var skip, limit, sort, project;
  if (query.query) {
    skip = query.skip;
    limit = query.limit;
    sort = query.sort;
    project = query.project;
  }
  var params = _.defaults(
    {
      id: uuid(),
      observe: query.query || query,
      collection: collection._name,
      skip: skip,
      limit: limit,
      sort: sort
    },
    defaults
  );
  if (project) {
    params.project = project;
  }
  return params;
};

var Observer = function (collection, options, query) {
  var remoteHandle = null;
  var self = this;
  self.handles = [];
  var events = {
    i: !_.isNil(options.init),
    a: !_.isNil(options.added),
    r: !_.isNil(options.removed),
    c: !_.isNil(options.changed),
    m: !_.isNil(options.moved)
  };

  var params = buildParams({ events: events }, query, collection);
  var startObserver = function () {
    var handle = collection._client.subscribe(params, function (err, result) {
      if (err) {
        handle.stop();
        startObserver();
        return;
      }
      if (remoteHandle || result.handle) {
        remoteHandle = result.handle || remoteHandle;

        if (self.handles.indexOf(params.id) > -1) {
          collection._client.request({ 'observe.stop': { h: params.id } });
          handle.stop();
          _.remove(self.handles, params.id);
        } else {
          _.forEach(result.changes, function (c) {
            if (c.i) {
              // init
              options.init(c.i.r);
            } else if (c.a) {
              // added
              options.added(c.a.e, c.a.i);
            } else if (c.r) {
              // removed
              options.removed(c.r.e, c.r.i);
            } else if (c.c) {
              // changed
              options.changed(c.c.o, c.c.n, c.c.i);
            } else if (c.m) {
              // moved
              options.moved(c.m.e, c.m.o, c.m.n);
            }
          });
        }
      }
    });

    return {
      stop: function () {
        if (!remoteHandle) {
          LOG.warn('WARN unsubscribing before receiving subscription handle from server');
          self.handles.push(params.id);
        } else {
          collection._client.request({ 'observe.stop': { h: params.id } });
          handle.stop();
        }
      }
    };
  };
  return startObserver();
};

module.exports = Observer;

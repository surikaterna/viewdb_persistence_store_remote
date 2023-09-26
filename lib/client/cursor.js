/* eslint-disable no-param-reassign */
// eslint-disable-next-line no-unused-vars
var LoggerFactory = require('slf').LoggerFactory;
var uuid = require('node-uuid').v4;
var Logger = require('slf').Logger;
var LOG = Logger.getLogger('lx:viewdb-persistence-store-remote');
var _ = require('lodash');
var Cursor = require('viewdb').Cursor;
var util = require('util');
var Observer = require('./observe');

var RemoteCursor = function (collection, query, options, getDocuments) {
  Cursor.call(this, collection, query, options, getDocuments);
};

util.inherits(RemoteCursor, Cursor);

RemoteCursor.prototype.count = function (applySkipLimit, options, callback) {
  if (_.isFunction(applySkipLimit)) {
    callback = applySkipLimit;
    applySkipLimit = true;
  }
  if (_.isFunction(options)) {
    callback = options;
    options = {};
  }

  var skip = _.get(this, '_query.skip', _.get(options, 'skip', 0));
  var limit = _.get(this, '_query.limit', _.get(options, 'limit', 0));

  var params = {
    id: uuid(),
    count: this._query.query || this._query,
    collection: this._collection._name
  };

  if (applySkipLimit) {
    params.skip = skip;
    params.limit = limit;
  }

  this._collection._client.request(params, function (err, result) {
    callback(err, result);
  });
};

RemoteCursor.prototype.sort = function (params) {
  this._query.sort = params;
  this._refresh();
  return this;
};

RemoteCursor.prototype.project = function (params) {
  this._query.project = params;
  return this;
};

RemoteCursor.prototype._refresh = function () {
  this._collection.emit('change');
};

RemoteCursor.prototype.observe = function (options) {
  var self = this;
  if (self._isObserving) {
    LOG.error('Already observing this cursor. Collection: %s - Query: %j', _.get(self, '_collection._name'), self._query);
    throw new Error('Already observing this cursor. Collection: ' + _.get(self, '_collection._name'));
  }
  self._isObserving = true;

  var refreshListener = function () {
    LOG.info('restarting observer due to change');
    self._handle.stop();
    self._handle = new Observer(self._collection, options, self._query);
  };
  self._collection.on('change', refreshListener);

  self._handle = new Observer(self._collection, options, self._query);
  return {
    stop: function () {
      self._handle.stop();
      self._collection.removeListener('change', refreshListener);
    }
  };
};

module.exports = RemoteCursor;

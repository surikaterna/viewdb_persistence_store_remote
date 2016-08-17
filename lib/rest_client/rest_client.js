var debug = require('debug');
var warn = debug('viewdb:warn');
var rp = require('request-promise');
var _ = require('lodash');
var merge = require('viewdb').merge;

var Client = function (url, headers, options) {
  if (!url) {
    throw Error('Cannot use REST viewdb client without URL');
  }
  this._pollInterval = options && options.pollInterval || 1000 * 30;

  if (url.slice(-1) === '/') {
    this._baseUri = url.substring(0, url.length - 1);
  } else {
    this._baseUri = url;
  }

  this._requestOptions = {
    headers: headers,
    json: true
  };
};

Client.prototype._callRestService = function (path, payload, callback) {
  var params = [];
  _.forEach(Object.keys(payload), function (key) {
    params.push(key + '=' + encodeURIComponent(JSON.stringify(payload[key])));
  });
  var uri = this._baseUri + '/' + path;
  if (params.length > 0) {
    uri += '?' + params.join('&');
  }
  var options = _.assign({}, this._requestOptions, { uri: uri });
  rp(options)
    .then(function (response) {
      callback(null, response);
    })
    .catch(function (err) {
      if (_.isUndefined(callback) || _.isUndefined(callback.cb)) {
        warn('API call failed. Error message: ' + err);
      } else {
        callback.cb(err);
      }
    });
};

// payload = {find:query, collection:this._name
Client.prototype.request = function (payload, callback) {
  var request = { q: payload.find };
  if (payload.skip) {
    request.skip = payload.skip;
  }
  if (payload.limit) {
    request.limit = payload.limit;
  }
  this._callRestService(payload.collection, request, callback);
};

// payload = {observe:this._query, collection:this._collection._name, events:events}
Client.prototype.subscribe = function (payload, callback) {
  var self = this;
  var cache = [];
  payload.find = payload.observe;
  function poll() {
    self.request(payload, function (err, result) {
      if (err) {
        callback(err);
      }
      var delta = [];
      merge(cache, result, _.defaults({
        comparatorId: function (a, b) {
          return a.id === b.id;
        }
      }, {
        added: function (e, i) {
          delta.push({ a: { e: e, i: i } });
          cache.splice(i, 0, e);
        },
        removed: function (e, i) {
          delta.push({ r: { e: e, i: i } });
          cache.splice(i, 1);
        },
        changed: function (asis, tobe, index) {
          delta.push({ c: { o: asis, n: tobe, i: index } });
          cache[index] = tobe;
        },
        moved: function (e, oldIndex, newIndex) {
          delta.push({ m: { e: e, o: oldIndex, n: newIndex } });
          cache.splice(oldIndex, 1);
          cache.splice(newIndex, 0, e);
        }
      }));
      callback(null, { changes: delta });
    });
  }

  var pollId = setInterval(poll, this._pollInterval);
  // do first call now
  poll();
  return {
    stop: function () {
      clearInterval(pollId);
    }
  };
};

module.exports = Client;

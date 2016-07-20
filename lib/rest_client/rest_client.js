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
  this._baseUri = url;
  this._requestOptions = {
    headers: headers,
    json: true
  };
};

Client.prototype._callRestService = function (payload, callback) {
  var params = [];
  _.forEach(Object.keys(payload), function (key) {
    params.push(key + '=' + encodeURIComponent(JSON.stringify(payload[key])));
  });
  var uri = this._baseUri;
  if (params.length > 0) {
    uri += '?' + params.join('&');
  }
  var options = _.assign({}, this._requestOptions, { uri: uri });
  rp(options)
    .then(function (response) {
      callback(null, response);
    })
    .catch(function (err) {
      callback(err);
      warn('API call failed. Error message: ' + err);
    });
};

Client.prototype.request = function (payload, callback) {
  this._callRestService(payload, callback);
};

Client.prototype.subscribe = function (payload, callback) {
  var self = this;
  var cache = [];

  function poll() {
    self.request(payload, function (err, result) {
      if (err) {
        callback(err);
      }
      var delta = [];
      merge(cache, result, _.defaults({
        comparatorId: function (a, b) {
          return a._id === b._id;
        }
      }, {
        added: function (e, i) {
          delta.push({ a: { e: e, i: i } });
        },
        removed: function (e, i) {
          delta.push({ r: { e: e, i: i } });
        },
        changed: function (asis, tobe, index) {
          delta.push({ c: { o: asis, n: tobe, i: index } });
        },
        moved: function (e, oldIndex, newIndex) {
          delta.push({ m: { e: e, o: oldIndex, n: newIndex } });
        }
      }));
      callback(null, { result: { changes: delta } });
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

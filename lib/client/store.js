var Promise = require('bluebird');
var Collection = require('./collection');

var Store = function (client) {
  this._collections = {};
  this._client = client;
};

Store.prototype.open = function (callback) {
  return Promise.resolve(this).nodeify(callback);
};

Store.prototype.collection = function (name, callback) {
  var collection = this._collections[name];
  if (!collection) {
    collection = this._collections[name] = new Collection(this._client, name);
  }
  if (callback) {
    callback(collection);
  }
  return collection;
};

// to signal that a socket reconnection have been made, and that observers need to start over.
// - socket owner is responsible to ensure that proper authentication/setup have been made before calling this function.
Store.prototype.onClientReconnected = function () {
  this._client.onClientReconnected();
};


module.exports = Store;

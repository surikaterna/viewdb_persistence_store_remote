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

module.exports = Store;

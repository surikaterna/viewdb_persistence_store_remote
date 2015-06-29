var Promise = require('bluebird');
var Collection = require('./collection');
var Client = require('./rr_client');

var Store = function(socket) {
	this._collections = {};
	this._client = new Client(socket);
}

Store.prototype.open = function(callback) {
	return Promise.resolve(this).nodeify(callback);
}

Store.prototype.collection = function(name, callback) {
	var collection = this._collections[name];
	if(!collection) {
		collection = this._collections[name] = new Collection(this._client, name);
	}
	if(callback) {
		callback(collection);
	}
	return collection;
}

module.exports = Store;
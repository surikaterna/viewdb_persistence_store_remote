var HybridStore = function(local, remote, options) {
	this._local = local;
	this._remote  = remote;
	this._options = options;
	this._collections = {};	
}

Store.prototype.collection = function(name, callback) {
	var collection = this._collections[name];
	if(!collection) {
		collection = this._collections[name] = new Collection(this._local.collection(name), this._remote.collection(name), name, this._options);
	}
	if(callback) {
		callback(collection);
	}
	return collection;
}

module.exports = HybridStore;
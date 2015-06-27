var defaultOptions = {
	syncWrites: false,
	cacheReads: true
}

var HybridCollection = function(local, remote, name, options) {
	this._local = local;
	this._remote = remote;
	this._name = name;
	this._options = options;
}

HybridCollection.prototype.find = function(query, options) {
	return new HybridCursor(this._local.find(query, options), this._remote.find(query, options), this._options);
};

HybridCollection.prototype.save = function(doc, callback) {
	if(this._options.syncWrites) {
		this._remote.save(doc, callback);
	}
	return this._local.save(doc, callback);
}

HybridCollection.prototype.insert = function(doc, callback) {
	return this._local.insert(doc, function(err, result) {
		if(this._options.syncWrites) {
			this._remote.insert(doc, callback);
		}
		callback(err, result);
	});
}
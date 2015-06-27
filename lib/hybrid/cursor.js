var HybridCursor = function(local, remote, findOptions, options) {
	this._local = local;
	this._remote = remote;
	this._findOptions = findOptions;
	this._options = options;
}

function merge(local, remote) {
	var localIds = _.pluck(local, '_id');
	var remoteIds = _.pluck(local, '_id');
	var newIds = _.without(localIds, remoteIds);
}

HybridCursor.prototype.toArray = function(callback) {
	//Merge strategy
	var self = this;
	var localData = null;
	var serverData = null;

	function serverResult(err, result) {
		serverData = result;
		if(localData) {
			callback(merge(localData, serverData));
		}
	}

	function localResult(err, result) {
		if(err) {
			callback(err, result);
		}

		localData = result;

		if(serverData) {
			callback(merge(localData, serverData));
		} else {
			if(self._options.localFirst) {
				callback(err, localData);
			}
		}
	}

	this._local.toArray(localResult);
	this._remote.toArray(serverResult);
};


module.exports = HybridCursor;
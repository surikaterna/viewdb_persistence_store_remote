var _ = require('lodash');

var Client = function(socket) {
	console.log("NEW CLIENT CREATED");
	this._socket = socket;
	this._requests = {};
	this._requestId = 10;
	var self = this;
	this._socket.on('/vdb/response', function(event) {
		console.log("response");
		console.log(self._requests);

		if(event.e) {
			throw new Error(event.e);
		}
		var callback = self._requests[event.i];
		if(_.isUndefined(callback)) {
			console.log(event);
			console.log(_.keys(self._requests));
			throw new Error("Response for unregisterd request", event);
		}
		callback(null, event.p);
	});
}

Client.prototype.request = function(payload, callback) {
	var req = {
		i: this._requestId++,
		p: payload
	};
	this._requests[req.i] = callback;
	this._socket.emit('/vdb/request', req);
	console.log("sending: " + _.keys(self._requests));
}

module.exports = Client;
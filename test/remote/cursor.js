var should = require('should');
var ViewDb = require('viewdb');
var ViewDbSocketServer = require('../../lib/server/server');
var Store = require('../../lib/client/store');
var Client = require('../../lib/client/rr_client');
var SocketMock = require('socket.io-mock');

describe('Remote server/client', function () {
  var clientVdb, remote, socketServer, socketClient;
  beforeEach(function (done) {
    socketServer = new SocketMock();
    socketClient = socketServer.socketClient;
    var client = new Client(socketClient);
    var clientStore = new Store(client);
    clientVdb = new ViewDb(clientStore);
    remote = new ViewDb();
    var vdbSocketServer = new ViewDbSocketServer(remote, socketServer);
    done();
  });
  it('#socketMock should work', function (done) {
    socketClient.on('ping', function (message) {
      message.should.equal('Hello');
      socketClient.emit('pong', 'heya');
    });
    socketServer.on('pong', function (message) {
      message.should.equal('heya');
      done();
    });
    socketServer.emit('ping', 'Hello');
  });
  it('#remote query', function (done) {
    remote.collection('dollhouse').insert({ _id: 'echo', test: 'success' });
    clientVdb.collection('dollhouse').find({ _id: 'echo' }).toArray(function (err, res) {
      res[0].test.should.equal('success');
      done();
    })
  });
  it('#remote cursor count', function (done) {
    remote.collection('dollhouse').insert({ _id: 'echo' });
    remote.collection('dollhouse').insert({ _id: 'echo2' });
    clientVdb.collection('dollhouse').find({ _id: 'echo' }).count(function (err, res) {
      res.should.equal(1);
      done();
    });
  });
  it('#remote cursor count should use skip/limit from cursor', function (done) {
    remote.collection('dollhouse').insert({ _id: 'echo' });
    remote.collection('dollhouse').insert({ _id: 'echo2' });
    remote.collection('dollhouse').insert({ _id: 'echo3' });
    clientVdb.collection('dollhouse').find({}).skip(1).limit(1).count(function (err, res) {
      res.should.equal(1);
      done();
    });
  });
  it('#remote cursor count should use skip from options', function (done) {
    remote.collection('dollhouse').insert({ _id: 'echo' });
    remote.collection('dollhouse').insert({ _id: 'echo2' });
    remote.collection('dollhouse').insert({ _id: 'echo3' });
    clientVdb.collection('dollhouse').find({}).count({}, { skip: 1  }, function (err, res) {
      res.should.equal(2);
      done();
    });
  });
  it('#remote cursor count should use limit from options', function (done) {
    remote.collection('dollhouse').insert({ _id: 'echo' });
    remote.collection('dollhouse').insert({ _id: 'echo2' });
    remote.collection('dollhouse').insert({ _id: 'echo3' });
    clientVdb.collection('dollhouse').find({}).count({}, { limit: 2 }, function (err, res) {
      res.should.equal(2);
      done();
    });
  });
  it('#remote collection count', function (done) {
    remote.collection('dollhouse').insert({ _id: 'echo' });
    remote.collection('dollhouse').insert({ _id: 'echo2' });
    clientVdb.collection('dollhouse').count({_id: 'echo'}, function (err, res) {
      res.should.equal(1);
      done();
    });
  });
  it('#remote collection count with skip', function (done) {
    remote.collection('dollhouse').insert({ _id: 'echo' });
    remote.collection('dollhouse').insert({ _id: 'echo2' });
    clientVdb.collection('dollhouse').count({}, {skip: 1}, function (err, res) {
      res.should.equal(1);
      done();
    });
  });
  it('#remote collection count with limit', function (done) {
    remote.collection('dollhouse').insert({ _id: 'echo' });
    remote.collection('dollhouse').insert({ _id: 'echo2' });
    clientVdb.collection('dollhouse').count({}, {limit: 1}, function (err, res) {
      res.should.equal(1);
      done();
    });
  });
});

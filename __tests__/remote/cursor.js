var should = require('should');
var ViewDb = require('viewdb');
var ViewDbSocketServer = require('../../lib/server/server');
var Store = require('../../lib/client/store');
var Client = require('../../lib/client/rr_client');
var SocketMock = require('socket.io-mock');
var HybridStore = require('../..').Hybrid;

describe('Remote server/client', function () {
  var clientVdb, remote, socketServer, socketClient, clientStore, client;
  beforeEach(function (done) {
    socketServer = new SocketMock();
    socketClient = socketServer.socketClient;
    client = new Client(socketClient);
    clientStore = new Store(client);
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
    clientVdb
      .collection('dollhouse')
      .find({ _id: 'echo' })
      .toArray(function (err, res) {
        res[0].test.should.equal('success');
        done();
      });
  });
  it('#remote cursor count', function (done) {
    remote.collection('dollhouse').insert({ _id: 'echo' });
    remote.collection('dollhouse').insert({ _id: 'echo2' });
    clientVdb
      .collection('dollhouse')
      .find({ _id: 'echo' })
      .count(function (err, res) {
        res.should.equal(1);
        done();
      });
  });
  it('#remote cursor count should use skip/limit from cursor', function (done) {
    remote.collection('dollhouse').insert({ _id: 'echo' });
    remote.collection('dollhouse').insert({ _id: 'echo2' });
    remote.collection('dollhouse').insert({ _id: 'echo3' });
    clientVdb
      .collection('dollhouse')
      .find({})
      .skip(1)
      .limit(1)
      .count(function (err, res) {
        res.should.equal(1);
        done();
      });
  });
  it('#remote cursor count should use skip from options', function (done) {
    remote.collection('dollhouse').insert({ _id: 'echo' });
    remote.collection('dollhouse').insert({ _id: 'echo2' });
    remote.collection('dollhouse').insert({ _id: 'echo3' });
    clientVdb
      .collection('dollhouse')
      .find({})
      .count({}, { skip: 1 }, function (err, res) {
        res.should.equal(2);
        done();
      });
  });
  it('#remote cursor count should use limit from options', function (done) {
    remote.collection('dollhouse').insert({ _id: 'echo' });
    remote.collection('dollhouse').insert({ _id: 'echo2' });
    remote.collection('dollhouse').insert({ _id: 'echo3' });
    clientVdb
      .collection('dollhouse')
      .find({})
      .count({}, { limit: 2 }, function (err, res) {
        res.should.equal(2);
        done();
      });
  });
  it('#remote collection count', function (done) {
    remote.collection('dollhouse').insert({ _id: 'echo' });
    remote.collection('dollhouse').insert({ _id: 'echo2' });
    clientVdb.collection('dollhouse').count({ _id: 'echo' }, function (err, res) {
      res.should.equal(1);
      done();
    });
  });
  it('#remote collection count with skip', function (done) {
    remote.collection('dollhouse').insert({ _id: 'echo' });
    remote.collection('dollhouse').insert({ _id: 'echo2' });
    clientVdb.collection('dollhouse').count({}, { skip: 1 }, function (err, res) {
      res.should.equal(1);
      done();
    });
  });
  it('#remote collection count with limit', function (done) {
    remote.collection('dollhouse').insert({ _id: 'echo' });
    remote.collection('dollhouse').insert({ _id: 'echo2' });
    clientVdb.collection('dollhouse').count({}, { limit: 1 }, function (err, res) {
      res.should.equal(1);
      done();
    });
  });
  it('#remote collection observe', function (done) {
    remote.collection('dollhouse').insert({ _id: 'echo' });
    remote.collection('dollhouse').insert({ _id: 'echo2' });
    var cursor = clientVdb.collection('dollhouse').find({ _id: { $in: ['echo2', 'echo3'] } });
    cursor.observe({
      init: function (init) {
        init.length.should.equal(1);
      },
      added: function (a) {
        a._id.should.equal('echo3');
        done();
      }
    });
    remote.collection('dollhouse').insert({ _id: 'echo3' });
  });
  it('#remote collection observe should call init again on reconnected', function (done) {
    remote.collection('dollhouse').insert({ _id: 'echo2' });
    var cursor = clientVdb.collection('dollhouse').find({ _id: { $in: ['echo2', 'echo3'] } });
    var inits = 0;
    cursor.observe({
      init: function (init) {
        inits++;
        if (inits === 1) {
          init.length.should.equal(1);
          remote.collection('dollhouse').insert({ _id: 'echo3' });
          client.onClientReconnected();
        } else if (inits === 2) {
          init.length.should.equal(2);
          done();
        }
      }
    });
  });
  it('#remote collection observe should continue to work on reconnected', function (done) {
    remote.collection('dollhouse').insert({ _id: 'echo2' });
    var cursor = clientVdb.collection('dollhouse').find({ _id: { $in: ['echo2', 'echo3'] } });
    var inits = 0;
    cursor.observe({
      init: function (init) {
        inits++;
        init.length.should.equal(1);
        if (inits === 1) {
          client.onClientReconnected();
          remote.collection('dollhouse').insert({ _id: 'echo3' });
        } else {
          inits.should.equal(2); // max 2 inits - 1 reconnect
        }
      },
      added: function (item) {
        item._id.should.equal('echo3');
        remote.collection('dollhouse').save({ _id: 'echo3', updated: true });
      },
      changed: function (asis, tobe) {
        tobe.updated.should.equal(true);
        done();
      }
    });
  });
  it('#remote reconnected should work with hybrid', function (done) {
    remote.collection('dollhouse').insert({ _id: 'echo2' });
    var local = new ViewDb();
    var hybrid = new ViewDb(new HybridStore(local, clientStore, { throttleObserveRefresh: 0 }));
    var list = [];
    var changes = 0;
    hybrid.open().then(function () {
      var cursor = hybrid.collection('dollhouse').find({ _id: { $in: ['echo2'] } });
      cursor.observe({
        init: function (init) {
          list = init;
        },
        added: function (element, index) {
          list.splice(index, 1);
          remote.collection('dollhouse').save({ _id: 'echo2', changed: 1 });
          client.onClientReconnected();
        },
        changed: function (asis, tobe, index) {
          changes++;
          remote.collection('dollhouse').save({ _id: 'echo2', changed: 2 });
          list[index] = tobe;
          list.length.should.equal(1);
          if (changes === 2) {
            done();
          }
        }
      });
    });
  });
});

var should = require('should');
var ViewDb = require('viewdb');
var _ = require('lodash');
var ViewDbSocketServer = require('../../lib/server/server');
var Store = require('../../lib/client/store');
var Client = require('../../lib/client/rr_client');
var SocketMock = require('socket.io-mock');
var HybridStore = require('../..').Hybrid;

describe('Observe-Update Remote', function () {
  var clientRemote, serverViewdb, socketServer, socketClient, clientStore, client, clientLocal, hybrid;
  beforeEach(function (done) {
    socketServer = new SocketMock();
    socketClient = socketServer.socketClient;
    client = new Client(socketClient);
    serverViewdb = new ViewDb();
    var vdbSocketServer = new ViewDbSocketServer(serverViewdb, socketServer);

    clientLocal = new ViewDb(); // client local viewdb (typically IndexedDb)
    clientStore = new Store(client);
    clientRemote = new ViewDb(clientStore); // client remote viewdb
    hybrid = new ViewDb(new HybridStore(clientLocal, clientRemote, { throttleObserveRefresh: 0 }));

    done();
  });
  it('#viewdb server+hybrid setup should work', function (done) {
    var id = 1,
      called = 0;
    serverViewdb.collection('dollhouse').insert({ _id: id });
    hybrid
      .collection('dollhouse')
      .find({ _id: id })
      .toArray(function (err, res) {
        if (called === 0) {
          called++;
        } else {
          done();
        }
      });
  });
  it('#old docs should be removed on updateQuery', function (done) {
    var id = 1;
    serverViewdb.collection('dollhouse').insert({ _id: id });
    var hybridCursor = hybrid.collection('dollhouse').find({ _id: id });
    var realDone = _.after(6, done);

    var handle = hybridCursor.observe({
      init: function () {
        realDone(); // 1 call
      },
      added: function (x) {
        realDone(); // 3 calls
        x._id.should.equal(id);
        if (x._id === 3) {
          handle.stop();
        } else {
          hybridCursor.updateQuery({ _id: ++id });
          serverViewdb.collection('dollhouse').insert({ _id: id });
        }
      },
      removed: function (x) {
        realDone(); // 2 calls
      }
    });
    serverViewdb.collection('dollhouse').insert({ _id: 'echo2' });
  });
  it('#update query from client', function (done) {
    var id = 1;
    serverViewdb.collection('dollhouse').insert({ _id: id });
    var hybridCursor = hybrid.collection('dollhouse').find({ _id: id });

    var handle = hybridCursor.observe({
      added: function (x) {
        x._id.should.equal(id);
        if (x._id === 3) {
          handle.stop();
          done();
        } else {
          hybridCursor.updateQuery({ _id: ++id });
          serverViewdb.collection('dollhouse').insert({ _id: id });
        }
      }
    });
    serverViewdb.collection('dollhouse').insert({ _id: 'echo2' });
  });
  it('#observe-update with update from server $in query', function (done) {
    serverViewdb.collection('dollhouse').insert({ _id: 1 });
    var realDone = _.after(2, done);
    var hybridCursor = hybrid.collection('dollhouse').find({ _id: { $in: [1, 2] } });

    var handle = hybridCursor.observe({
      added: function (x) {
        if (x._id === 3) {
          handle.stop();
          realDone();
        } else {
          hybridCursor.updateQuery({ _id: { $in: [2, 3] } });
          serverViewdb.collection('dollhouse').insert({ _id: 3 });
        }
      },
      removed: function (x) {
        x._id.should.equal(1);
        realDone();
      }
    });
  });
});

var should = require('should');
var _ = require('lodash');
var ViewDb = require('viewdb');
var ViewDbRemoteClient = require('../../').Client;
var SocketClient = require('../../').SocketClient;
var HybridStore = require('../..').Hybrid;

describe('Observe-Update', function () {
  var local = null;
  var remote = null;
  var hybrid = null;

  beforeEach(function (done) {
    local = new ViewDb();
    var socketIoMock = {
      emit: function () {},
      on: function () {}
    };
    remote = new ViewDbRemoteClient(new SocketClient(socketIoMock));
    hybrid = new ViewDb(new HybridStore(local, remote, { throttleObserveRefresh: 0 }));
    hybrid.open().then(function () {
      done();
    });
  });

  it('#observe-update with update query', function (done) {
    var id = 1;
    local.collection('dollhouse').insert({ _id: id });
    var cursor = hybrid.collection('dollhouse').find({ _id: id });

    var handle = cursor.observe({
      added: function (x) {
        x._id.should.equal(id);
        if (x._id === 3) {
          handle.stop();
          done();
        } else {
          cursor.updateQuery({ _id: ++id });
          local.collection('dollhouse').insert({ _id: id });
        }
      }
    });
    local.collection('dollhouse').insert({ _id: 'echo2' });
  });
  it('#observe-update with update $in query', function (done) {
    local.collection('dollhouse').insert({ _id: 1 });
    var realDone = _.after(2, done);
    var cursor = hybrid.collection('dollhouse').find({ _id: { $in: [1, 2] } });

    var handle = cursor.observe({
      added: function (x) {
        if (x._id === 3) {
          handle.stop();
          realDone();
        } else {
          cursor.updateQuery({ _id: { $in: [2, 3] } });
          local.collection('dollhouse').insert({ _id: 3 });
        }
      },
      removed: function (x) {
        x._id.should.equal(1);
        realDone();
      }
    });
  });
});

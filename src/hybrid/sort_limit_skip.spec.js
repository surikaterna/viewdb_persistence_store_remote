var ViewDb = require('viewdb');
var HybridStore = require('..').Hybrid;
var _ = require('lodash');

describe('Sort / Limit / Skip', function () {
  var local = null;
  var remote = null;
  var hybrid = null;

  beforeEach(function (done) {
    local = new ViewDb();
    remote = new ViewDb();
    hybrid = new ViewDb(new HybridStore(local, remote, { throttleObserveRefresh: 0 }));
    hybrid.open().then(function () {
      done()
    });
  });

  it('#toArray with sort / limit', function (done) {
    var NUMBER_OF_DOCS = 20;
    var LIMIT = 5;
    hybrid.open().then(function () {

      var onPopulated = _.after(NUMBER_OF_DOCS, function () {
        var cursor = hybrid.collection('dollhouse').find({ _id: { $gte: 0 } }).sort({ age: 1 }).limit(LIMIT);
        cursor.toArray(_.after(2, function (err, res) {
          expect(res).toHaveLength(LIMIT);
          for (var i = 0; i < LIMIT; i++) {
            expect(res[i].age).toBe(i);
          }
          done();
        }));
      });

      const remoteCollection = remote.collection('dollhouse');
      const localCollection = local.collection('dollhouse');

      for (var i = 0; i < NUMBER_OF_DOCS; i++) {
        var collection = i % 2 === 0 ? localCollection : remoteCollection;
        collection.insert({ _id: i, age: i }, onPopulated);
      }
    });
  });
  it.skip('#toArray with sort / skip / limit', function (done) {
    var NUMBER_DOCS_REMOTE = 5;
    var NUMBER_DOCS_LOCAL = 3;
    var LIMIT = 3;
    var SKIP = 2;

    hybrid.open().then(function () {
      var onPopulated = _.after(NUMBER_DOCS_REMOTE + NUMBER_DOCS_LOCAL, function () {
        var cursor = hybrid.collection('dollhouse').find({}).sort({ name: 1 }).skip(SKIP).limit(LIMIT);
        cursor.toArray(_.after(2, function (err, res) {
          // todo: assert
          done();
        }));
      });

      // populate
      const remoteCollection = remote.collection('dollhouse');
      const localCollection = local.collection('dollhouse');
      for (var i = 0; i < NUMBER_DOCS_REMOTE; i++) {
        remoteCollection.insert({ _id: 'a' + i, name: 'a'.repeat(i + 1) }, onPopulated);
      }
      for (var i = 0; i < NUMBER_DOCS_LOCAL; i++) {
        localCollection.insert({ _id: 'z' + i, name: 'z'.repeat(i + 1) }, onPopulated);
      }
    });
  });
})

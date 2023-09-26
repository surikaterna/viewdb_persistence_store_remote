var Store = require('../../lib/hybrid/store');
var LocalStore = require('viewdb/lib/inmemory/store');
var should = require('should');
var Cursor = require('viewdb/lib').Cursor;

describe('Store', function () {
  it('should cache', function (done) {
    var localStore = new LocalStore();
    var remoteStore = new LocalStore();

    remoteStore.collection('alfa').insert({ id: 'abc' }, function () {
      var hcursor = new Store(localStore, remoteStore, { cacheQueries: true });
      hcursor
        .collection('alfa')
        .find({})
        .toArray(function (err, res) {
          if (res.length > 0) {
            // Caching of data is not sync action, wait for next tick before fetching data
            setTimeout(function () {
              hcursor.collection('alfa')._getCachedData({}, undefined, undefined, undefined, undefined, function (err, data) {
                data.length.should.equal(1);
                done();
              });
            });
          }
        });
    });
  });

  it('should cache projected data separate', function (done) {
    Cursor.prototype.project = function (project) {
      this._project = project;
      return this;
    };
    var localStore = new LocalStore();
    var remoteStore = new LocalStore();

    remoteStore.collection('alfa').insert({ id: 'abc', property: 'def' }, function () {
      var hcursor = new Store(localStore, remoteStore, { cacheQueries: true });
      hcursor
        .collection('alfa')
        .find({ id: 'abc' })
        .project({ id: 1 })
        .toArray(function (err, res) {
          if (res.length > 0) {
            // Caching of data is not sync action, wait for next tick before fetching data
            setTimeout(function () {
              hcursor
                .collection('alfa')
                .find({ id: 'abc' })
                .toArray(function (err2, projectedRes) {
                  if (projectedRes.length > 0) {
                    setTimeout(function () {
                      hcursor.collection('alfa')._getCachedData({ id: 'abc' }, undefined, undefined, undefined, undefined, function (_err, data) {
                        hcursor.collection('alfa')._getCachedData({ id: 'abc' }, undefined, undefined, undefined, { id: 1 }, function (_err2, projectedData) {
                          data.length.should.equal(1);
                          projectedData.length.should.equal(1);
                          projectedData[0]._insertedAt.should.be.below(data[0]._insertedAt);
                          done();
                        });
                      });
                    });
                  }
                });
            });
          }
        });
    });
  });

  it('should call remote if cache is no longer correct', function (done) {
    var localStore = new LocalStore();
    var remoteStore = new LocalStore();

    remoteStore.collection('alfa').insert({ id: 'abc' }, function () {
      var hcursor = new Store(localStore, remoteStore, { cacheQueries: true });

      hcursor
        .collection('alfa')
        .find({})
        .toArray(function (err, res) {
          if (res.length > 0) {
            setTimeout(function () {
              hcursor.collection('alfa')._getCachedData({}, undefined, undefined, undefined, undefined, function (err, data) {
                data.length.should.equal(1);
              });
            });
          }
        });

      var iterations = 0;
      setTimeout(function () {
        hcursor._local._collections._cache._documents[0].resultSet = ['xyz'];
        hcursor._collections._cache._documents.resultSet = ['xyz'];
        hcursor
          .collection('alfa')
          .find({})
          .toArray(function (err, res) {
            iterations += 1;
            res.length.should.equal(1);
            if (iterations > 1 || res.length === 0) {
              done();
            }
          });
      });
    });
  });
});

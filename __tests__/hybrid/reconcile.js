var should = require('should');
var reconcile = require('../../lib/hybrid/reconcile');

describe('Reconcile', function () {
  it('#reconcile should return remote docs if only remote', function () {
    reconcile([], [{ _id: 1 }]).length.should.equal(1);
  });

  it('#reconcile should return local docs if only local', function () {
    reconcile([{ _id: 1 }], []).length.should.equal(1);
  });
  it('#reconcile should return empty if no local or remote docs', function () {
    reconcile([], []).length.should.equal(0);
  });
  it('#reconcile should return all docs if local and remote docs do not match', function () {
    reconcile([{ _id: 1 }, { _id: 2 }], [{ _id: 3 }, { _id: 4 }]).length.should.equal(4);
  });
  it('#reconcile should return some docs if local and remote docs do match', function () {
    reconcile([{ _id: 1 }, { _id: 2 }], [{ _id: 1 }, { _id: 2 }]).length.should.equal(2);
  });
  it('#reconcile should return remote docs if local and remote docs do match', function () {
    var result = reconcile(
      [{ _id: 1 }, { _id: 2 }],
      [
        { _id: 1, a: 1 },
        { _id: 2, a: 2 }
      ]
    );
    result[0].should.have.property('a');
    result[1].should.have.property('a');
  });
  it('#reconcile should return local docs if local and remote docs do match and local version higher', function () {
    var result = reconcile(
      [
        { _id: 1, version: 2 },
        { _id: 2, version: 2 }
      ],
      [
        { _id: 1, a: 1, version: 1 },
        { _id: 2, a: 2, version: 1 }
      ]
    );
    result[0].should.not.have.property('a');
    result[1].should.not.have.property('a');
  });
  it('#reconcile should return remote docs if local and remote docs do match and remote version higher', function () {
    var result = reconcile(
      [
        { _id: 1, version: 1 },
        { _id: 2, version: 1 }
      ],
      [
        { _id: 1, a: 1, version: 2 },
        { _id: 2, a: 2, version: 2 }
      ]
    );
    result[0].should.have.property('a');
    result[1].should.have.property('a');
  });
  it('#reconcile should work timely with large arrays', function () {
    var local = [],
      remote = [];
    for (var i = 0; i < 1000; i++) {
      local.push({ _id: i, version: 1 });
      remote.push({ _id: i, version: 1 });
    }
    var start = new Date().getTime();
    var result = reconcile(local, remote);
    var end = new Date().getTime();
    (end - start).should.be.below(500);
  });
  it('#reconcile should not break if local contain duplicates, and should update to newest version of local copy', function () {
    const result = reconcile([{ _id: 1, version: 1 }, { _id: 1, version: 2 }], [{ _id: 1, version: 1 }])
    result[0].version.should.equal(2)
  })
  it('#reconcile should not break if local contain duplicates, and should get best copy with version', function () {
    const result = reconcile([{ _id: 1 }, { _id: 1, version: 1 }], [{ _id: 1 }])
    result[0].version.should.equal(1);
  })
});

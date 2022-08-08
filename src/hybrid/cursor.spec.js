var Cursor = require('./cursor');
var LocalCursor = require('viewdb').Cursor;

describe('Cursor', function() {
  it('#toArray should return remote', function(done) {
    var lcursor = new LocalCursor(null, {}, null, function(query, callback) {
      callback(null, [{_id:1},{_id:2}]);
    });
    var rcursor = new LocalCursor(null, {}, null, function(query, callback) {
      callback(null, [{_id:1},{_id:2}]);
    });
    var hcursor = new Cursor({}, lcursor, rcursor, {}, {})
    hcursor.toArray(function(err, result) {
      expect(result).toHaveLength(2);
      done();
    });
  });
  it('#toArray with localFirst should call callback twice', function(done) {
    var lcursor = new LocalCursor(null, {}, null, function(query, callback) {
      callback(null, [{_id:1},{_id:2}]);
    });
    var rcursor = new LocalCursor(null, {}, null, function(query, callback) {
      callback(null, [{_id:1},{_id:2}]);
    });
    var hcursor = new Cursor({}, lcursor, rcursor, {}, {localFirst:true})
    var calls = 0;
    hcursor.toArray(function(err, result) {
      if(++calls===2) {
        done();
      }
    });
  });
  it('#toArray with localFirst false should call callback once', function(done) {
    var lcursor = new LocalCursor(null, {}, null, function(query, callback) {
      callback(null, [{_id:1},{_id:2}]);
    });
    var rcursor = new LocalCursor(null, {}, null, function(query, callback) {
      callback(null, [{_id:1},{_id:2}]);
    });
    var hcursor = new Cursor({}, lcursor, rcursor, {}, {localFirst:false})
    var calls = 0;
    hcursor.toArray(function(err, result) {
      done();
    });
  });
  it('#toArray with versions should merge correctly', function(done) {
    var lcursor = new LocalCursor(null, {}, null, function(query, callback) {
      callback(null, [{_id:1, version:1, local:true},{_id:2, version:2, local:true}]);
    });
    var rcursor = new LocalCursor(null, {}, null, function(query, callback) {
      callback(null, [{_id:1, version:2, local:false},{_id:2, version:1, local:false}]);
    });
    var hcursor = new Cursor({}, lcursor, rcursor, {}, {localFirst:false})
    var calls = 0;
    hcursor.toArray(function(err, result) {
      expect(result[0].local).toBe(false);
      expect(result[1].local).toBe(true);
      done();
    });
  });

  it('#toArray with local data first should return correctly', function(done) {
    var lcursor = new LocalCursor(null, {}, null, function(query, callback) {
      setTimeout(function() {callback(null, [{_id:1, version:1, local:true},{_id:2, version:2, local:true}]);}, 10);
    });
    var rcursor = new LocalCursor(null, {}, null, function(query, callback) {
      callback(null, [{_id:1, version:2, local:false},{_id:2, version:1, local:false}]);
    });
    var hcursor = new Cursor({}, lcursor, rcursor, {}, {localFirst:false})
    var calls = 0;
    hcursor.toArray(function(err, result) {
      expect(result[0].local).toBe(false);
      expect(result[1].local).toBe(true);
      done();
    });
  });
  it('#toArray should throw on local error', function(done) {
    var lcursor = new LocalCursor(null, {}, null, function(query, callback) {
      callback(new Error());
    });
    var rcursor = new LocalCursor(null, {}, null, function(query, callback) {
      callback(null, [{_id:1, version:2, local:false},{_id:2, version:1, local:false}]);
    });
    var hcursor = new Cursor({}, lcursor, rcursor, {}, {localFirst:false})
    var calls = 0;
    hcursor.toArray(function(err, result) {
      expect(err).toBeDefined();
      done();
    });
  });
  it('#toArray should throw on remote error', function(done) {
    var lcursor = new LocalCursor(null, {}, null, function(query, callback) {
      callback(null, [{_id:1, version:2, local:false},{_id:2, version:1, local:false}]);
    });
    var rcursor = new LocalCursor(null, {}, null, function(query, callback) {
      callback(new Error());
    });
    var hcursor = new Cursor({}, lcursor, rcursor, {}, {localFirst:false, throwRemoteErr:true})
    var calls = 0;
    hcursor.toArray(function(err, result) {
      expect(err).toBeDefined();
      done();
    });
  });
  it('#toArray should not throw on remote error if opted out', function(done) {
    var lcursor = new LocalCursor(null, {}, null, function(query, callback) {
      callback(null, [{_id:1, version:2, local:false},{_id:2, version:1, local:false}]);
    });
    var rcursor = new LocalCursor(null, {}, null, function(query, callback) {
      callback(new Error());
    });
    var hcursor = new Cursor({}, lcursor, rcursor, {}, {localFirst:false, throwRemoteErr:false})
    var calls = 0;
    hcursor.toArray(function(err, result) {
      expect(err).toBeNull();
      expect(result).toHaveLength(2);
      done();
    });
  });
  it('#toArray should not throw on using $elemMatch with $ne and $eq', function(done) {
    var query = { things: { $elemMatch: { name: { $eq: 'banana' }, category: { $ne: 'toy' } } } };
    var lcursor = new LocalCursor(null, query, null, function(query, callback) {
      setTimeout(function() {
        callback(
          null,
          [
            {
              _id:1,
              things: [
                { name: 'banana', category: 'fruit' },
                { name: 'orange', category: 'toy' }
              ],
              version:1,
              local:true
            },
            {
              _id:2,
              things: [
                { name: 'banana', category: 'toy' },
                { name: 'orange', category: 'fruit' }
              ],
              version:2,
              local:true
            }
          ]
        );
      }, 10);
    });
    var rcursor = new LocalCursor(null, query, null, function(query, callback) {
      callback(new Error());
    });
    var hcursor = new Cursor(query, lcursor, rcursor, {}, {localFirst:false, throwRemoteErr:false})
    var calls = 0;
    hcursor.toArray(function(err, result) {
      expect(err).toBeNull();
      expect(result).toHaveLength(1);
      expect(result[0].things[0].name).toBe('banana');
      expect(result[0].things[0].category).toBe('fruit');
      done();
    });
  });
  it('#toArray should not throw on remote error if opted out and delayed local response', function(done) {
    var lcursor = new LocalCursor(null, {}, null, function(query, callback) {
      setTimeout(function() {callback(null, [{_id:1, version:1, local:true},{_id:2, version:2, local:true}]);}, 10);
    });
    var rcursor = new LocalCursor(null, {}, null, function(query, callback) {
      callback(new Error());
    });
    var hcursor = new Cursor({}, lcursor, rcursor, {}, {localFirst:false, throwRemoteErr:false})
    var calls = 0;
    hcursor.toArray(function(err, result) {
      expect(err).toBeNull();
      expect(result).toHaveLength(2);
      done();
    });
  });
  it('#toArray should throw on remote error if not opted out and delayed local response', function(done) {
    var lcursor = new LocalCursor(null, {}, null, function(query, callback) {
      setTimeout(function() {callback(null, [{_id:1, version:1, local:true},{_id:2, version:2, local:true}]);}, 10);
    });
    var rcursor = new LocalCursor(null, {}, null, function(query, callback) {
      callback(new Error());
    });
    var hcursor = new Cursor({}, lcursor, rcursor, {}, {localFirst:false, throwRemoteErr:true})
    var calls = 0;
    hcursor.toArray(function(err, result) {
      expect(err).toBeDefined();
      done();
    });
  });
})

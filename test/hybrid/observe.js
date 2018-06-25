var should = require('should');
var ViewDb = require('viewdb');
var HybridStore = require('../..').Hybrid;
var _ = require('lodash');

describe('Observe', function() {
	var local = null;
	var remote = null;
	var hybrid = null;

	beforeEach(function(done){
		local = new ViewDb();
		remote = new ViewDb();
		hybrid = new ViewDb(new HybridStore(local, remote, {throttleObserveRefresh:0}));
		hybrid.open().then(function() {done()});
	});

	it('#observe with local insert', function(done) {
		var cursor = hybrid.collection('dollhouse').find({});
		var handle = cursor.observe({
			added:function(x) {
				x._id.should.equal('echo');
				handle.stop();
				done();
			}
		});
		local.collection('dollhouse').insert({_id:'echo'});
	});
	it('#observe with query and local insert', function(done) {
		remote.collection('dollhouse').insert({_id:'echo'});
		var cursor = hybrid.collection('dollhouse').find({_id:'echo2'});
		var handle = cursor.observe({
			added:function(x) {
				x._id.should.equal('echo2');
				handle.stop();
				done();
			}
		});
		local.collection('dollhouse').insert({_id:'echo2'});
	});	
	it('#observe called twice with one local and one remote insert', function(done) {
		remote.collection('dollhouse').insert({_id:'echo'});
		var cursor = hybrid.collection('dollhouse').find({_id:'echo2'});
		var called = 0;
		var handle = cursor.observe({
			added:function(x) {
				if(++called===2) {
					done();
				}
			},
			changed:function(x) {
				if(++called===2) {
					handle.stop();
					done();
				}
			}
		});
		local.collection('dollhouse').insert({_id:'echo2'});
		remote.collection('dollhouse').insert({_id:'echo2', remote:true});

	});	
	it('#observe with query and update', function(done) {
		var store = new ViewDb();
		store.open().then(function() {
				var cursor = store.collection('dollhouse').find({_id:'echo'});
				var handle = cursor.observe({
					added:function(x) {
						x.age.should.equal(10);
						x._id.should.equal('echo');
					}, changed:function(o,n) {
						o.age.should.equal(10);
						n.age.should.equal(100);
						handle.stop();
						done();
					}
				});
			
			store.collection('dollhouse').insert({_id:'echo', age:10}, function(){
				store.collection('dollhouse').save({_id:'echo', age:100});
			});			
		});
  });
  it('#observe with both empty local and remote result', function(done) {
    var cursor = hybrid.collection('dollhouse').find({_id:'echo2'});
    var handle = cursor.observe({
      init:function(r) {
        r.length.should.equal(0);
        handle.stop();
        done();
      },
      added:function(x) {
      	console.log(x);
        done(new Error('uh oh'));
      }
    });
  });
  it('#toArray with sort / limit', function(done) {
		var NUMBER_OF_DOCS = 20;
		var LIMIT = 5;
    hybrid.open().then(function() {

      var onPopulated = _.after(NUMBER_OF_DOCS, function () {
        var cursor = hybrid.collection('dollhouse').find({ _id: { $gte: 0 }}).sort({age: 1}).limit(LIMIT);
        cursor.toArray(_.after(2, function (err, res) {
          res.length.should.equal(LIMIT);
        	for (var i = 0; i < LIMIT; i++) {
        		res[i].age.should.equal(i);
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
  it.skip('#toArray with sort / skip / limit', function(done) {
		var NUMBER_DOCS_REMOTE = 5;
		var NUMBER_DOCS_LOCAL = 3;
    var LIMIT = 3;
    var SKIP = 2;

    hybrid.open().then(function () {
      var onPopulated = _.after(NUMBER_DOCS_REMOTE + NUMBER_DOCS_LOCAL, function () {
        var cursor = hybrid.collection('dollhouse').find({}).sort({ name: 1 }).skip(SKIP).limit(LIMIT);
        cursor.toArray(_.after(2, function (err, res) {
          /*
          res:
					 [
						{ _id: 'a0', name: 'a' },
						{ _id: 'a1', name: 'aa' },
						{ _id: 'a2', name: 'aaa' },
						{ _id: 'a3', name: 'aaaa' },
						{ _id: 'a4', name: 'aaaaa' },
						{ _id: 'z0', name: 'z' },
						{ _id: 'z1', name: 'zz' },
						{ _id: 'z2', name: 'zzz' }
					 ]
				 */
          done();
        }));
      });

      // populate
      const remoteCollection = remote.collection('dollhouse');
      const localCollection = local.collection('dollhouse');
      for (var i = 0; i < NUMBER_DOCS_REMOTE; i++) {
        remoteCollection.insert({ _id: 'a' + i, name: 'a'.repeat(i+1)}, onPopulated);
      }
      for (var i = 0; i < NUMBER_DOCS_LOCAL; i++) {
        localCollection.insert({ _id: 'z' + i, name: 'z'.repeat(i+1)}, onPopulated);
      }
    });
  });
})

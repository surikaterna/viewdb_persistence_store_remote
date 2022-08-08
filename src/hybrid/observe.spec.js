var ViewDb = require('viewdb');
var HybridStore = require('..').Hybrid;

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
				expect(x._id).toBe('echo');
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
				expect(x._id).toBe('echo2');
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
						expect(x.age).toBe(10);
						expect(x._id).toBe('echo');
					}, changed:function(o,n) {
						expect(o.age).toBe(10);
						expect(n.age).toBe(100);
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
        expect(r).toHaveLength(0);
        handle.stop();
        done();
      },
      added:function(x) {
      	console.log(x);
        done(new Error('uh oh'));
      }
    });
  });
	it('#should cache query if setting is enabled', function(done) {
		hybrid = new ViewDb(new HybridStore(local, remote, { throttleObserveRefresh: 0, cacheQueries: true, queryMaxTime: 2 }));
		hybrid.open().then(function() {
			var cursor = hybrid.collection('dollhouse').find({});
			cursor.observe({
				added: function () {
					setTimeout(function() {
							hybrid.collection('dollhouse')._getCachedData({}, 0, 0, undefined, undefined, function (err, cachedDocuments) {
								expect(cachedDocuments).toHaveLength(1);
								expect(cachedDocuments[0]._id).toBe('alfa');
								expect(cachedDocuments[0].age).toBe(100);
								done();
							});
					});
				}
			});

			remote.collection('dollhouse').insert({ _id: 'alfa', age: 100 });
		});
	});
});

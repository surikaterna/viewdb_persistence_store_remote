var should = require('should');
var _ = require('lodash');
var ViewDb = require('viewdb');
var HybridStore = require('../..').Hybrid;

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
  it('#observe with update query', function(done) {
  	var id = 1;
    remote.collection('dollhouse').insert({_id:id});
    var cursor = hybrid.collection('dollhouse').find({_id:id});

    var handle = cursor.observe({
      added:function(x) {
        x._id.should.equal(id);
        if (x._id === 3) {
					handle.stop();
					done();
				} else {
					cursor.updateQuery({_id:++id});
					remote.collection('dollhouse').insert({_id:id});
				}
      }
    });
    local.collection('dollhouse').insert({_id:'echo2'});
  });
  it('#observe with update $in query', function(done) {
    remote.collection('dollhouse').insert({_id: 1});
    var realDone = _.after(2, done);
    var cursor = hybrid.collection('dollhouse').find({_id: { $in: [1, 2]}});

    var handle = cursor.observe({
      added:function(x) {
        if (x._id === 3) {
					handle.stop();
					realDone();
				} else {
          cursor.updateQuery({ _id: { $in: [2, 3] } });
					remote.collection('dollhouse').insert({_id:3});
				}
      },
			removed:function (x) {
				x._id.should.equal(1);
				realDone();
      }
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
})

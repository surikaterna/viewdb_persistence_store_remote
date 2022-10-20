import reconcile from './reconcile';

describe('Reconcile', function() {
	it('#reconcile should return remote docs if only remote', function() {
		expect(reconcile([], [{_id:1}])).toHaveLength(1);
	})

	it('#reconcile should return local docs if only local', function() {
		expect(reconcile([{_id:1}], [])).toHaveLength(1);
	})
	it('#reconcile should return empty if no local or remote docs', function() {
		expect(reconcile([], [])).toHaveLength(0);
	})
	it('#reconcile should return all docs if local and remote docs do not match', function() {
		expect(reconcile([{_id:1}, {_id:2}], [{_id:3},{_id:4}])).toHaveLength(4);
	})
	it('#reconcile should return some docs if local and remote docs do match', function() {
		expect(reconcile([{_id:1}, {_id:2}], [{_id:1},{_id:2}])).toHaveLength(2);
	})
	it('#reconcile should return remote docs if local and remote docs do match', function() {
		var result = reconcile([{_id:1}, {_id:2}], [{_id:1, a:1},{_id:2, a:2}]);
		expect(result[0]).toHaveProperty('a');
		expect(result[1]).toHaveProperty('a');
	})
	it('#reconcile should return local docs if local and remote docs do match and local version higher', function() {
		var result = reconcile([{_id:1, version:2}, {_id:2, version:2}], [{_id:1, a:1, version:1},{_id:2, a:2, version:1}]);
		expect(result[0]).not.toHaveProperty('a');
		expect(result[1]).not.toHaveProperty('a');
	})
	it('#reconcile should return remote docs if local and remote docs do match and remote version higher', function() {
		var result = reconcile([{_id:1, version:1}, {_id:2, version:1}], [{_id:1, a:1, version:2},{_id:2, a:2, version:2}]);
		expect(result[0]).toHaveProperty('a');
		expect(result[1]).toHaveProperty('a');
	})
	it('#reconcile should work timely with large arrays', function() {
		var local = [], remote=[];
		for(var i=0;i<1000; i++) {
			local.push({_id:i, version:1});
			remote.push({_id:i, version:1});
		}
		var start = new Date().getTime();
		reconcile(local, remote);
		var end = new Date().getTime();
		expect(end-start).toBeLessThan(500);
	})
});

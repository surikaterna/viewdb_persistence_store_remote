var _ = require('lodash');

module.exports = function reconcile(local, remote) {
  // Stupid merge logic
  // 0. Add the new docs to the result
  // 1. If has .version take one with highest version
  // 2. If no version prefer remote

  var localIds = _.map(local, '_id');
  var remoteIds = _.map(remote, '_id');

  var newIds = _.xor(localIds, remoteIds);
  var inBothIds = _.intersection(localIds, remoteIds);

  var alldocs = local.concat(remote);

  // add all new docs
  var result = _.filter(alldocs, function (doc) {
    return _.includes(newIds, doc._id);
  });
  var localSame = _(local)
    .filter(function (doc) {
      return _.includes(inBothIds, doc._id);
    })
    .sortBy('_id')
    .value();
  var remoteSame = _(remote)
    .filter(function (doc) {
      return _.includes(inBothIds, doc._id);
    })
    .sortBy('_id')
    .value();

  // TODO; optimize so not a scan per id is needed
  _.forEach(localSame, function (localDoc, n) {
    var remoteDoc = remoteSame[n];

    if (!_.isUndefined(localDoc.version) && !_.isUndefined(remoteDoc.version)) {
      result.push(localDoc.version > remoteDoc.version ? localDoc : remoteDoc);
    } else {
      result.push(remoteDoc);
    }
  });
  return result;
};

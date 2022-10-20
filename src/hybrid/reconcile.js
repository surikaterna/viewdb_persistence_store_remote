import { filter, forEach, includes, intersection, isUndefined, map, sortBy, xor } from 'lodash';

export default function reconcile(local, remote) {
  // Stupid merge logic
  // 0. Add the new docs to the result
  // 1. If they have versions, take the one with the highest version
  // 2. If no version, prefer remote

  const localIds = map(local, '_id');
  const remoteIds = map(remote, '_id');

  const newIds = xor(localIds, remoteIds);
  const inBothIds = intersection(localIds, remoteIds);

  const alldocs = local.concat(remote);

  // add all new docs
  const result = filter(alldocs, (doc) => includes(newIds, doc._id));
  const localSame = sortBy(filter(local, (doc) => includes(inBothIds, doc._id)), '_id');
  const remoteSame = sortBy(filter(remote, (doc) => includes(inBothIds, doc._id)), '_id');

  // TODO; optimize so not a scan per id is needed
  forEach(localSame, (localDoc, n) => {
    const remoteDoc = remoteSame[n];

    if (!isUndefined(localDoc.version) && !isUndefined(remoteDoc.version)) {
      result.push(localDoc.version > remoteDoc.version ? localDoc : remoteDoc);
    } else {
      result.push(remoteDoc);
    }
  });

  return result;
}

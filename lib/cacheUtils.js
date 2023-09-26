var SHA256 = require('crypto-js/sha256');

exports.generateQueryHash = function (query, collection, skip, limit, sort, project) {
  return SHA256(`${collection}:${skip || 0}:${limit || 0}:${JSON.stringify(sort || {})}:${JSON.stringify(project || {})}:${JSON.stringify(query)}`).toString();
};

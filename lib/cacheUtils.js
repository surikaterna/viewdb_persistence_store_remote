var SHA256 = require("crypto-js/sha256");

exports.generateQueryHash = function (query, collection, skip, limit, sort) {
  return SHA256(
    `${collection}:${skip}:${limit}:${JSON.stringify(sort)}:${JSON.stringify(query)}`
  ).toString();
};
import SHA256 from 'crypto-js/sha256';

export function generateQueryHash(query, collection, skip, limit, sort, project) {
  return SHA256(
    `${collection}:${skip || 0}:${limit || 0}:${JSON.stringify(sort || {})}:${JSON.stringify(project || {})}:${JSON.stringify(query)}`
  ).toString();
}

import Promise from 'bluebird';
import Collection from './collection';

export default class Store {
  constructor(client) {
    this._collections = {};
    this._client = client;
  }

  open(callback) {
    return Promise.resolve(this).nodeify(callback);
  }

  collection(name, callback) {
    let collection = this._collections[name];

    if (!collection) {
      collection = this._collections[name] = new Collection(this._client, name);
    }

    if (callback) {
      callback(collection);
    }

    return collection;
  }
}

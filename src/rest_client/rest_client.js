import rp from 'request-promise';
import { assign, defaults, forEach, isUndefined } from 'lodash';
import { LoggerFactory } from 'slf';
import { merge } from 'viewdb';

const log = LoggerFactory.getLogger('viewdb:persistence-store:remote:rest-client');

export default class Client {
  constructor(url, headers, options) {
    if (!url) {
      throw Error('Cannot use REST viewdb client without URL');
    }

    this._pollInterval = options && options.pollInterval || 1000 * 30;

    if (url.slice(-1) === '/') {
      this._baseUri = url.substring(0, url.length - 1);
    } else {
      this._baseUri = url;
    }

    this._requestOptions = {
      headers: headers,
      json: true
    };
  }

  // payload = {find:query, collection:this._name}
  request(payload, callback) {
    if (payload['observe.stop']) {
      return;
    }

    const request = { q: payload.find || payload.observe };

    if (payload.skip) {
      request.skip = payload.skip;
    }

    if (payload.sort) {
      request.sort = payload.sort;
    }

    if (payload.limit) {
      request.limit = payload.limit;
    }

    if (payload.method) {
      request.method = payload.method;
    }

    this._callRestService(payload.collection, request, callback);
  }

  // payload = {observe:this._query, collection:this._collection._name, events:events}
  subscribe(payload, callback) {
    const cache = [];
    payload.find = payload.observe;

    const poll = () => {
      this.request(payload, (err, result) => {
        if (err) {
          callback(err);
        }

        const changes = [];
        merge(cache, result, defaults({
          comparatorId: (a, b) => a.id === b.id
        }, {
          added: (e, i) => {
            changes.push({ a: { e: e, i: i } });
            cache.splice(i, 0, e);
          },
          removed: (e, i) => {
            changes.push({ r: { e: e, i: i } });
            cache.splice(i, 1);
          },
          changed: (asis, tobe, index) => {
            changes.push({ c: { o: asis, n: tobe, i: index } });
            cache[index] = tobe;
          },
          moved: (e, oldIndex, newIndex) => {
            changes.push({ m: { e: e, o: oldIndex, n: newIndex } });
            cache.splice(oldIndex, 1);
            cache.splice(newIndex, 0, e);
          }
        }));

        callback(null, { changes });
      });
    }

    const pollId = setInterval(poll, this._pollInterval);
    // do first call now
    poll();

    return {
      stop: () => {
        clearInterval(pollId);
      }
    };
  }

  _callRestService(path, payload, callback) {
    const params = [];

    forEach(Object.keys(payload), function (key) {
      params.push(key + '=' + encodeURIComponent(JSON.stringify(payload[key])));
    });

    const uriParams = params.length > 0 ? `?${params.join('&')}` : '';
    const uri = `${this._baseUri}/${path}${uriParams}`;

    const options = assign({}, this._requestOptions, { uri });

    rp(options)
      .then((response) => {
        callback(null, response);
      })
      .catch((err) => {
        if (isUndefined(callback)) {
          log.warn('API call failed. Error message: %o', err);
        } else {
          callback(err);
        }
      });
  }
}

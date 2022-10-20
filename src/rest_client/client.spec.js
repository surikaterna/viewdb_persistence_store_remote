var nock = require('nock');
import { Client as Store, RestClient as Client } from '..';
var mockResponse = require('../rest_client/mock-response.json');
var _ = require('lodash');

var testOptions = {
  pollInterval: 15
};

describe('RestClient', function () {
  afterEach(function() {
    nock.cleanAll();
  });
  it('#request should work', function (done) {
    var restClient = new Client('http://www.example.com/', {}, testOptions);
    nock('http://www.example.com')
      .get('/party?q=%7B%22name%22%3A%22Firstname%22%7D')
      .reply(200, mockResponse);

    restClient.request({ find: { name: 'Firstname' }, collection: 'party' }, function (err, result) {
      expect(result).toEqual(mockResponse);
      done();
    });
  });

  it('#skiplimit url should be correct', function (done) {
    var restClient = new Client('http://www.example.com/', {}, testOptions);
    nock('http://www.example.com')
      .get('/party?q=%7B%22name%22%3A%22Firstname%22%7D&skip=50&limit=77')
      .reply(function () {
        done();
        return [201, mockResponse, {}];
      });
    var store = new Store(restClient);
    store.collection('party').find({ name: 'Firstname' }).skip(50).limit(77).toArray(function () {});
  });

  it('#observe should work', function (done) {
    var restClient = new Client('http://www.example.com/', {}, testOptions);
    var handle;
    var realDone = _.after(2, function () {
      handle.stop();
      done();
    });
    nock('http://www.example.com')
      .persist() // keep nock alive after first call
      .get('/shipment?q=%7B%22name%22%3A%22a%22%7D&skip=1&limit=100')
      .reply(function () {
        realDone();
        return [201, mockResponse, {}];
      });

    // {observe:this._query, collection:this._collection._name, events:events}
    handle = restClient.subscribe({ observe: { name: 'a' }, collection: 'shipment', events: {}, skip: 1, limit: 100 }, function () {});
  });

  it('#observe should stop when calling stop', function (done) {
    var restClient = new Client('http://www.example.com/', {}, testOptions);
    var hitCount = 0;
    var stop;

    nock('http://www.example.com')
      .persist() // keep nock alive after first call
      .get('/parcel?q=%7B%22name%22%3A%22a%22%7D')
      .reply(function () {
        hitCount++;
        stop();
        return [201, mockResponse, {}];
      });

    var observer = restClient.subscribe({ observe: { name: 'a' }, collection: 'parcel', events: {} }, function () {});
    stop = _.after(1, observer.stop)

    setTimeout(function () {
      expect(hitCount).toBe(1);
      done();
    }, 15);
  });

  it('#observe should notify changes', function (done) {
    var restClient = new Client('http://www.example.com', {}, testOptions);

    // mock returning response with data - dies after one hit
    nock('http://www.example.com')
      .get('/party?q=%7B%22name%22%3A%22a%22%7D')
      .reply(201, mockResponse);
    // mock returning empty response
    nock('http://www.example.com')
      .get('/party?q=%7B%22name%22%3A%22a%22%7D')
      .reply(201, {});

    var hits = 0;
    var verify = function (res) {
      ++hits;
      if (hits === 1) {
        expect(res.changes[0].a.e.name).toBe('firstName');
        expect(res.changes).toHaveLength(1);
      }
      if (hits === 2) {
        handle.stop();
        expect(res.changes[0].r.e.name).toBe('firstName');
        done();
      }
    };

    const handle = restClient.subscribe({ observe: { name: 'a' }, collection: 'party', events: {} }, function (err, res) {
      verify(res);
    });
  });
});

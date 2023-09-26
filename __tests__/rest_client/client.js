var nock = require('nock');
var Client = require('../..').RestClient;
var Store = require('../..').Client;
var should = require('should');
var mockResponse = require('./mock-response.json');
var _ = require('lodash');

var testOptions = {
  pollInterval: 15
};

describe('RestClient', function () {
  afterEach(function () {
    nock.cleanAll();
  });
  it('#request should work', function (done) {
    var restClient = new Client('http://www.example.com/', {}, testOptions);
    nock('http://www.example.com').get('/party?q=%7B%22name%22%3A%22Firstname%22%7D').reply(200, mockResponse);

    restClient.request({ find: { name: 'Firstname' }, collection: 'party' }, function (err, result) {
      should.deepEqual(result, mockResponse);
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
    store
      .collection('party')
      .find({ name: 'Firstname' })
      .skip(50)
      .limit(77)
      .toArray(function () {});
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
    const restClient = new Client('http://www.example.com/', {}, testOptions);
    let hitCount = 0;
    let stop;

    nock('http://www.example.com')
      .persist() // keep nock alive after first call
      .get('/parcel?q=%7B%22name%22%3A%22a%22%7D')
      .reply(function () {
        hitCount++;
        stop();
        return [201, mockResponse, {}];
      });

    const observer = restClient.subscribe({ observe: { name: 'a' }, collection: 'parcel', events: {} }, function () {});
    stop = _.after(1, observer.stop);

    setTimeout(function () {
      hitCount.should.equal(1);
      done();
    }, 15);
  });

  it('#observe should notify changes', function (done) {
    const restClient = new Client('http://www.example.com', {}, testOptions);

    // mock returning response with data - dies after one hit
    nock('http://www.example.com').get('/party?q=%7B%22name%22%3A%22a%22%7D').reply(201, mockResponse);
    // mock returning empty response
    nock('http://www.example.com').get('/party?q=%7B%22name%22%3A%22a%22%7D').reply(201, {});

    let hits = 0;
    const verify = function (res) {
      ++hits;
      if (hits === 1) {
        should.equal(res.changes[0].a.e.name, 'firstName');
        should.equal(res.changes.length, 1);
      }
      if (hits === 2) {
        handle.stop();
        should.equal(res.changes[0].r.e.name, 'firstName');
        done();
      }
    };

    const handle = restClient.subscribe({ observe: { name: 'a' }, collection: 'party', events: {} }, function (err, res) {
      if (res) {
        verify(res);
      }
    });
  });
});

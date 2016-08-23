var nock = require('nock');
var Client = require('../..').RestClient;
var Store = require('../..').Client;
var should = require('should');
var mockResponse = require('./mock-response.json');

var testOptions = {
  pollInterval: 15
};

describe('RestClient', function () {
  it('#request should work', function (done) {
    var restClient = new Client('http://www.example.com/', {}, testOptions);
    nock('http://www.example.com')
      .get('/party?q=%7B%22name%22%3A%22Firstname%22%7D')
      .reply(200, mockResponse);

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
    store.collection('party').find({ name: 'Firstname' }).skip(50).limit(77).toArray(function () {});
  });

  it('#observe should work', function (done) {
    var restClient = new Client('http://www.example.com/', {}, testOptions);
    var hitCount = 0;

    nock('http://www.example.com')
      .persist() // keep nock alive after first call
      .get('/shipment?q=%7B%22name%22%3A%22a%22%7D&skip=1&limit=100')
      .reply(function () {
        hitCount++;
        return [201, mockResponse, {}];
      });

    // {observe:this._query, collection:this._collection._name, events:events}
    restClient.subscribe({ observe: { name: 'a' }, collection: 'shipment', events: {}, skip: 1, limit: 100 }, function () {});

    // wait 70ms to see if >=5 calls were made (initial request at 0ms)
    setTimeout(function () {
      should.equal(true, (hitCount >= 5));
      done();
    }, 70);
  });

  it('#observe should stop when calling stop', function (done) {
    var restClient = new Client('http://www.example.com/', {}, testOptions);
    var hitCount = 0;

    nock('http://www.example.com')
      .persist() // keep nock alive after first call
      .get('/parcel?q=%7B%22name%22%3A%22a%22%7D')
      .reply(function () {
        hitCount++;
        return [201, mockResponse, {}];
      });

    var observer = restClient.subscribe({ observe: { name: 'a' }, collection: 'parcel', events: {} }, function () {});

    // stop observerver after 15ms, should be just enough for 2 calls (initial call at 0ms)
    setTimeout(function () {
      observer.stop();
    }, 15);

    setTimeout(function () {
      hitCount.should.equal(2);
      done();
    }, 20);
  });

  it('#observe should notify changes', function (done) {
    var restClient = new Client('http://www.example.com', {}, testOptions);
    var hitCount = 0;

    // mock returning response with data - dies after one hit
    nock('http://www.example.com')
      .get('/party?q=%7B%22name%22%3A%22a%22%7D')
      .reply(function () {
        hitCount++;
        return [201, mockResponse, {}];
      });
    // mock returning empty response
    nock('http://www.example.com')
      .get('/party?q=%7B%22name%22%3A%22a%22%7D')
      .reply(function () {
        hitCount++;
        return [201, {}, {}];
      });

    restClient.subscribe({ observe: { name: 'a' }, collection: 'party', events: {} }, function (err, res) {
      if (hitCount === 1) {
        should.equal(res.changes[0].a.e.name, 'firstName');
        should.equal(res.changes.length, 1);
      }
      if (hitCount === 2) {
        should.equal(res.changes[0].r.e.name, 'firstName');
        done();
      }
    });
  });
});

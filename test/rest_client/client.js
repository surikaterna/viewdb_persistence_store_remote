var nock = require('nock');
var Client = require('../..').RestClient;
var should = require('should');
var mockResponse = require('./mock-response.json');

var testOptions = {
  pollInterval: 10
};

describe('RestClient', function () {
  it('#request should work', function (done) {
    var restClient = new Client('http://www.example.com/basic', {}, testOptions);
    nock('http://www.example.com')
      .get('/basic?q=%7B%22name%22%3A%22Firstname%22%7D')
      .reply(200, mockResponse);

    restClient.request({ q: { name: 'Firstname' } }, function (err, result) {
      should.deepEqual(result, mockResponse);
      done();
    });
  });

  it('#observe should work', function (done) {
    var restClient = new Client('http://www.example.com/observe', {}, testOptions);
    var hitCount = 0;

    nock('http://www.example.com')
      .persist() // keep nock alive after first call
      .get('/observe?q=%7B%22name%22%3A%22a%22%7D&skip=0&limit=100')
      .reply(function () {
        hitCount++;
        return [201, mockResponse, {}];
      });

    restClient.subscribe({ q: { name: 'a' }, skip: 0, limit: 100 }, function () {});

    // wait 49ms to see if 5 calls were made (initial request at 0ms)
    setTimeout(function () {
      should.equal(true, (hitCount >= 5));
      done();
    }, 49);
  });

  it('#observe should stop when calling stop', function (done) {
    var restClient = new Client('http://www.example.com/callstop', {}, testOptions);
    var hitCount = 0;

    nock('http://www.example.com')
      .persist() // keep nock alive after first call
      .get('/callstop?q=%7B%22name%22%3A%22a%22%7D')
      .reply(function () {
        hitCount++;
        return [201, mockResponse, {}];
      });

    var observer = restClient.subscribe({ q: { name: 'a' } }, function () {});

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
    var restClient = new Client('http://www.example.com/changes', {}, testOptions);
    var hitCount = 0;

    // mock returning response with data - dies after one hit
    nock('http://www.example.com')
      .get('/changes?q=%7B%22name%22%3A%22a%22%7D')
      .reply(function () {
        hitCount++;
        return [201, mockResponse, {}];
      });
    // mock returning empty response
    nock('http://www.example.com')
      .get('/changes?q=%7B%22name%22%3A%22a%22%7D')
      .reply(function () {
        hitCount++;
        return [201, {}, {}];
      });

    restClient.subscribe({ q: { name: 'a' } }, function (err, res) {
      if (hitCount === 1) {
        should.equal(res.result.changes[0].a.e.name, 'firstName');
        should.equal(res.result.changes.length, 1);
      }
      if (hitCount === 2) {
        should.equal(res.result.changes.length, 0);
        done();
      }
    });
  });
});

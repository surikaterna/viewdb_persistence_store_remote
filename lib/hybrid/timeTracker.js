var TimeTracker = function () {
  this._startTime = -1;
  this._stopTime = -1;
};

TimeTracker.prototype.start = function () {
  this._startTime = Date.now();
};

TimeTracker.prototype.stop = function () {
  this._stopTime = Date.now();
};

/**
 * @returns time between start and stop is called in seconds
 */
TimeTracker.prototype.getExecutionTime = function () {
  return (this._stopTime - this._startTime) / 1000;
};

module.exports = TimeTracker;

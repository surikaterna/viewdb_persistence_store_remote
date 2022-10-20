export default class TimeTracker {
  constructor() {
    this._startTime = -1;
    this._stopTime = -1;
  }

  start() {
    this._startTime = Date.now();
  }

  stop() {
    this._stopTime = Date.now();
  }

  /**
   * @returns time between start and stop is called in seconds
   */
  getExecutionTime() {
    return (this._stopTime - this._startTime) / 1000;
  }
}

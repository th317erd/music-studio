/* global BigInt */

const commonBase = require('../common/base-utils');

const NS_PER_MS             = BigInt(1e6),
      HUNDRETH_NANOSECOND   = BigInt(1e4),
      PROCESS_START_TIME    = BigInt(Date.now()) * NS_PER_MS,
      HR_PROCESS_START_TIME = (process && typeof process.httime !== 'undefined') ? process.hrtime.bigint() : BigInt(0),
      START_TIME_OFFSET     = PROCESS_START_TIME - HR_PROCESS_START_TIME;

function throwHTTPError(_statusCode, _message, errors) {
  var statusCode = _statusCode || 500,
      message = _message;

  if (!message) {
    if (statusCode === 404)
      message = 'Not Found';
    else if (statusCode === 400)
      message = 'Bad Request';
    else if (statusCode === 413)
      message = 'Request Entity Too Large';
    else if (statusCode === 500)
      message = 'Internal Server Error';
    else
      message = 'Unknown Error';
  }

  var error = new Error(message);
  error.errors = errors;
  error.status = statusCode;

  throw error;
}

function preciseTime() {
  var currentTime       = process.hrtime.bigint(),
      realTimeNS        = currentTime + START_TIME_OFFSET,
      milliseconds      = parseFloat(realTimeNS / HUNDRETH_NANOSECOND) / 100,
      seconds           = milliseconds / 1000;

  return {
    seconds,
    milliseconds,
    nanoseconds: realTimeNS
  };
}

module.exports = Object.assign({}, commonBase, {
  throwHTTPError,
  preciseTime
});

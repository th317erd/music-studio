/* globals Headers */

const utils = require('@root/base-utils');

module.exports = utils.memoizeModule(function(_globalOpts) {
  const globalOpts = _globalOpts || {},
        base64    = require('base-64'),
        U         = require('evisit-js-utils').utils,
        D         = require('evisit-js-utils').data,
        {
          APIEngine,
          APIRoute
        }         = require('./api-engine')(globalOpts);

  class APIError extends Error {
    constructor(...args) {
      super(...args);
    }
  }

  function getErrorMessage(response, _errors) {
    var errors = (_errors) ? _errors : response.errors;
    if (!Array.isArray(errors))
      errors = [errors];

    errors = errors.filter((error) => !!error);

    return errors.join('. ');
  }

  function throwAPIError(_response, _errors) {
    var response = _response || {},
        errors = _errors || response.errors,
        error = new APIError(getErrorMessage(response, errors));

    error.response = response;
    error.errors = errors;

    throw error;
  }

  function requestToCURL(request) {
    var parts = ['curl', '-v', '-X' + request.method.toUpperCase()];

    var headers = Object.keys(request.headers || {});
    for (var i = 0, il = headers.length; i < il; i++) {
      var header = headers[i],
          val = request.headers[header];

      parts.push('-H');
      parts.push("'" + header + ': ' + val.replace(/'/g, '\'"\'"\'') + "'");
    }

    parts.push("'" + request.url + "'");

    /* TODO: Properly deal with multi-part data */
    if (U.instanceOf(request.body, 'string')) {
      parts.push('-d');
      parts.push("'" + request.body.replace(/'/g, '\'"\'"\'') + "'");
    }

    parts.push('--compressed');

    return parts.join(' ');
  }

  class APIBase extends APIEngine {
    constructor() {
      super(...arguments);

      Object.defineProperty(this, 'debug', {
        enumerable: false,
        configurable: false,
        get: () => global.__DEV__,
        set: () => {}
      });
    }

    throwError() {
      return throwAPIError.apply(this, arguments);
    }

    cleanHeaders(headers) {
      if (!headers)
        return {};

      var newHeaders = {},
          keys = Object.keys(headers);

      for (var i = 0, il = keys.length; i < il; i++) {
        var name = keys[i],
            value = headers[name];

        if (!U.noe(value))
          newHeaders[name] = value;
      }

      return newHeaders;
    }

    toQueryString(...args) {
      return utils.toQueryString.call(this, ...args);
    }

    parseQueryParams(url) {
      if (U.noe(url))
        return {};

      return utils.parseURIParts(url).params;
    }

    makeURLQueryString(url, data) {
      var currentData = {
        ...this.parseQueryParams(url),
        ...data
      };

      return ('' + url).replace(/\?.*?$/, '') + utils.toQueryString.call(this, currentData);
    }

    formatDataForSending(data) {
      var contentType = this.header('content-type');
      if (('' + contentType).match(/^application\/json/i) && !(typeof data === 'string' || data instanceof String)) {
        return JSON.stringify(data, function(key, value) {
          if (('' + key).charAt(0) === '_')
            return undefined;
          return value;
        });
      } else if (('' + contentType).toLowerCase() === 'application/x-www-form-urlencoded') {
        return utils.toQueryString.call(this, data, undefined, '');
      }

      return data;
    }

    mapHeadersToObject(_headers) {
      var headers = _headers;
      if (!headers)
        return {};

      if (headers.constructor !== Object && headers.map)
        headers = headers.map;

      var keys = Object.keys(headers),
          newHeaders = {};

      for (var key of keys) {
        var val = headers[key];
        newHeaders[key.toLowerCase()] = (Array.isArray(val)) ? val.join('; ') : val;
      }

      return newHeaders;
    }

    mapObjectToHeaders(headers) {
      //###if(MOBILE) {###//
      return headers;
      //###} else {###//
      var keys = Object.keys(headers),
          headersDefined = (typeof Headers !== 'undefined'),
          finalHeaders = (headersDefined) ? new Headers() : {};

      for (var i = 0, il = keys.length; i < il; i++) {
        var key = keys[i],
            value = headers[key];

        if (headersDefined)
          finalHeaders.append(key, value);
        else
          finalHeaders[key.toLowerCase()] = value;
      }

      console.log(finalHeaders, headers);
      global.finalHeaders = finalHeaders;

      return finalHeaders;
      //###}###//
    }

    async fetch(route) {
      const isGet = ('' + route.method).match(/^get$/i);

      if (!route.headers)
        route.headers = {};

      var bodyData = (isGet) ? undefined : this.formatDataForSending.call(route, route.data),
          url = (isGet) ? this.makeURLQueryString(route.url, route.data) : route.url,
          headers = this.cleanHeaders(route.headers),
          requestObject = {
            method: route.method,
            url: url,
            headers: headers,
            body: bodyData
          };

      if (this.debug) {
        var requestStart = new Date();
        requestObject.curl = requestToCURL(requestObject);
        console.log('API REQUEST: ' + url, {
          method: requestObject.method,
          url: requestObject.url,
          headers: requestObject.headers,
          body: route.data,
          data: requestObject.bodyData
        });
      }

      var response = await this.doNetworkRequest(route.method, url, headers, bodyData, route);
      if (this.debug) {
        var requestEnd = new Date(),
            time = (requestEnd.getTime() - requestStart.getTime());

        console.log(`API RESPONSE: (${time}ms) ` + url, response);
      }

      if (response.status < 200 || response.status > 299)
        throwAPIError(response);

      var errors = response.errors;
      if (errors && errors.length)
        throwAPIError(response, errors);

      return response;
    }

    async doNetworkRequest(method, url, headers, bodyData, route) {
      async function parseResponse(response) {
        var parsedData,
            responseHeaders;

        //###if(MOBILE) {###//
        responseHeaders = this.mapHeadersToObject(U.get(response, 'headers'));
        //###} else {###//
        responseHeaders = {};
        response.headers.forEach((value, name) => {
          responseHeaders[name] = value;
        });
        //###}###//

        try {
          parsedData = await response.text();
          if (('' + responseHeaders['content-type']).match(/^application\/json/i)) {
            if (!U.noe(parsedData))
              parsedData = JSON.parse(parsedData);
            else
              parsedData = {};
          }
        } catch (e) {
          if (this.debug)
            console.warn('COULDNT PARSE JSON IN RESPONSE: ', parsedData, e);

          return {
            status: false,
            headers: {},
            body: {
              error: 'An unknown error occurred'
            }
          };
        }

        return {
          status: response.status,
          headers: responseHeaders,
          body: parsedData,
          errors: (parsedData && parsedData.errors)
        };
      }

      var response = await fetch(url, {
        method: method,
        headers: this.mapObjectToHeaders(headers),
        body: bodyData,
        cache: 'no-store',
        credentials: 'same-origin'
      });

      var parsedResponse = await parseResponse.call(this, response);
      return parsedResponse;
    }
  }

  class APIRouteBase extends APIRoute {
    constructor(...args) {
      super(...args);

      Object.defineProperty(this, 'debug', {
        enumerable: false,
        configurable: false,
        get: () => global.__DEV__,
        set: () => {}
      });

      this.headers = {
        'Cache-Control': 'no-cache',
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json',
        ...this.headers
      };
    }

    buildAuthorizationHeader(user, password) {
      var auth = `${encodeURIComponent(user)}:${encodeURIComponent(password)}`;
      return `Basic ${base64.encode(auth)}`;
    }

    routeOptions(opts) {
      D.extend(D.extend.DEEP|D.extend.FILTER, (key, val, obj, dstObj, dstVal, depth) => {
        if (depth === 0 && key === 'data')
          return false;

        return true;
      }, this, opts);

      this.data = opts.data;
    }

    async beforeSuccess(response) {
      if (!response)
        return response;

      var body = response.body;
      if (!body)
        return response;

      var data = body.data;
      if (data && typeof data === 'string')
        body.data = U.safeJSONParse(data);

      return response;
    }

    async success(response) {
      return response;
    }
  }

  return {
    APIError,
    APIBase,
    APIRouteBase
  };
});

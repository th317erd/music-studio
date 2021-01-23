/* global Buffer */

const U = require('evisit-js-utils').utils;

// This function wraps a function
// and will always return the same
// cached return value for the same
// unique input arguments
function memoize(func, _argNumber) {
  var memoizeCache = [];

  return function(...args) {
    // cache is still valid if all arguments match
    function isCached(cache) {
      var cacheArgs = cache.args;
      for (var i = 0, il = (_argNumber || args.length); i < il; i++) {
        if (cacheArgs[i] !== args[i])
          return false;
      }

      return true;
    }

    // see if this function has a cached return value
    // cache is valid if all arguments match
    var cache = memoizeCache.find(isCached);
    if (cache)
      return cache.result;

    // no cached value found... call function and cache result
    var result = func.apply(this, args);
    memoizeCache.push({ args, result });

    return result;
  };
}

// This is the same as memoize but locks the cache to the first argument only
function memoizeModule(func) {
  return memoize(func, 1);
}


/**
* @function capitalize Uppercase the first letter of a string
* @return {String} Return input string with the first character uppercased
**/
function capitalize(str) {
  if (!str)
    return str;

  return (str.charAt(0).toUpperCase() + str.substring(1));
}

/**
* @function regExpEscape Escape special characters in a Regular Expression
* @return {String} Return string with special characters escaped
**/
function regExpEscape(str) {
  if (!str)
    return str;

  return str.replace(/[-[\]{}()*+!<=:?.\/\\^$|#\s,]/g, '\\$&');
}

/**
* @function toNumber Flexibly parse numbers
* @return {String} Return parsed number, or defaultValue if number couldn't be parsed
**/
function toNumber(value, defaultValue) {
  if ((typeof value === 'number' || (value instanceof Number))) {
    if (isFinite(value))
      return value.valueOf();
    else
      return defaultValue;
  }

  var number = parseFloat(('' + value).replace(/[^\d.-]/g, ''));
  if (isNaN(number) || !isFinite(number))
    return defaultValue || 0;

  return number;
}

/**
* @function generateUUID Generate a random UUID
* @return {String} Return randomly generated UUID
**/
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = (c === 'x') ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function castValueToPrimitive(value) {
  if (!value)
    return value;

  if (value === 'true')
    return true;
  else if (value === 'false')
    return false;
  else if (typeof value === 'string' && value.match(/^[\d.,-]+$/))
    return toNumber(value, value);

  return value;
}

class URIParts {
  constructor(uri, _opts) {
    var opts = _opts || {};

    Object.defineProperties(this, {
      options: {
        writable: true,
        enumerable: false,
        configurable: true,
        value: opts
      }
    });

    Object.assign(this, this.parse(uri, opts));
  }

  hasHost(schema, subSchema) {
    if (schema === 'jdbc' && ('' + subSchema).match(/^(sqlite$)/))
      return false;

    if (('' + schema).match(/^(tty|file)$/i))
      return false;

    return true;
  }

  parseURIQueryParams(paramsStr, _opts) {
    var opts = _opts || this.options,
        params = {},
        parts = { params };

    ('' + paramsStr).replace(/#([^#]+)$/g, (m, hash) => {
      parts.hash = hash.replace(/\+/g, ' ').trim();
      return '';
    }).replace(/\+/g, ' ').replace(/&*([^=]+)=([^&]*)/g, (m, name, value) => {
      var decodedValue = decodeURIComponent(value);
      if (opts.convertParams)
        decodedValue = castValueToPrimitive(decodedValue);

      params[decodeURIComponent(name)] = decodedValue;
    });

    return parts;
  }

  parse(_uri, _opts) {
    var opts = _opts || this.options,
        uri = ('' + _uri).trim(),
        parts = {
          hash: '',
          schema: undefined,
          protocol: undefined
        };

    if (opts === true)
      opts = { convertParams: true };

    uri = uri.replace(/^jdbc:/i, (m) => {
      parts.schema = 'jdbc';
      parts.protocol = 'jdbc:';
      return '';
    });

    uri = uri.replace(/^([^:]+):\/\//, (m, _schema) => {
      var schema = decodeURIComponent(_schema).toLowerCase();

      if (parts.schema) {
        parts.subSchema = schema;
        parts.subProtocol = schema + ':';
      } else {
        parts.schema = schema;
        parts.protocol = schema + ':';
      }

      return '';
    });

    uri = uri.replace(/\?([^?]*?)$/, (m, params) => {
      Object.assign(parts, this.parseURIQueryParams(params, opts));
      return '';
    });

    if (this.hasHost(parts.schema, parts.subSchema)) {
      uri = uri.replace(/^([^:/?]{2,})(:[^\/]+)?/, (m, _hostname, _port) => {
        var hostname = decodeURIComponent(_hostname),
            port = ('' + _port).replace(/\D/g, '');

        if (!port)
          port = 80;

        parts.hostname = hostname;
        parts.port = port;
        parts.host = hostname + ((_port) ? (':' + port) : '');
        return '';
      }).trim();

      parts.pathname = uri || '/';
      parts.origin = parts.protocol + '//' + parts.host;
      parts.href = `${parts.origin}${(parts.pathname) ? parts.pathname : ''}${toQueryString(parts.params)}`;
    } else {
      parts.resource = uri;
    }

    return parts;
  }

  toString() {
    var resource = this.hasHost(this.schema, this.subSchema) ? this.host : this.resource;
    return [this.protocol, (this.subSchema) ? `${this.subSchema}:` : null, '//', resource, this.pathname, toQueryString(this.params), (this.hash) ? `#${this.hash}` : null].filter(Boolean).join('');
  }
}

function parseURIParts(uri, opts) {
  return new URIParts(uri, opts);
}

function toQueryString(data, nameFormatter, resolveInitial) {
  if (!data || U.sizeOf(data) === 0)
    return '';

  var initial = '?',
      parts = [],
      keys = Object.keys(data);

  if (resolveInitial !== undefined && resolveInitial !== null)
    initial = (typeof resolveInitial === 'function') ? resolveInitial.call(this) : resolveInitial;

  for (var i = 0, il = keys.length; i < il; i++) {
    var name = keys[i],
        value = data[name];

    if (U.noe(value))
      continue;

    name = (typeof nameFormatter === 'function') ? nameFormatter.call(this, name) : name;

    parts.push(encodeURIComponent(name) + '=' + encodeURIComponent(value));
  }

  if (parts.length === 0)
    return '';

  return initial + parts.join('&');
}

function createResolvable(callback) {
  var y, n, status = 'pending', promise = new Promise((_y, _n) => {
    y = _y;
    n = _n;
  });

  U.defineROProperty(promise, 'resolve', (value) => {
    status = 'fulfilled';
    y(value);

    if (typeof callback === 'function')
      callback(null, value);
  });

  U.defineROProperty(promise, 'reject', (value) => {
    status = 'rejected';
    n(value);

    if (typeof callback === 'function')
      callback(value, null);
  });

  U.defineROProperty(promise, 'status', undefined, () => status, () => {});

  return promise;
}

function searchAndReplaceFactory(variables, dangerous) {
  var keys = Object.keys(variables);

  if (dangerous !== true) {
    keys = keys.map(regExpEscape);
    var globalRE = new RegExp(`\\b(${keys.join('|')})\\b`, 'g');
    return function replacer(sourceStr) {
      globalRE.lastIndex = 0;
      return sourceStr.replace(globalRE, function(m, p) {
        var val = variables[p];
        if (typeof val === 'function')
          val = val.apply(this, arguments);

        return ('' + val);
      });
    };
  } else {
    var items = keys.map((key) => {
          return {
            key,
            re: new RegExp(key, 'g')
          };
        }),
        itemsLen = items.length;

    return function replacer(_sourceStr) {
      var sourceStr = _sourceStr;
      for (var i = 0; i < itemsLen; i++) {
        var item = items[i],
            val = variables[item.key];

        sourceStr = sourceStr.replace(item.re, function(m) {
          if (typeof val === 'function')
            val = val.apply(this, arguments);

          return ('' + val);
        });
      }

      return sourceStr;
    };
  }
}

function copyStaticMethods(klass, _parentKlass) {
  var parentKlass = (_parentKlass) ? _parentKlass : Object.getPrototypeOf(klass);
  if (!parentKlass)
    return klass;

  if (parentKlass === Object.getPrototypeOf(Object))
    return;

  var keys = Object.getOwnPropertyNames(parentKlass);
  for (var i = 0, il = keys.length; i < il; i++) {
    var key = keys[i];
    if (key.match(/^(arguments|callee||caller)$/))
      continue;

    if (klass.hasOwnProperty(key))
      continue;

    var value = parentKlass[key];
    if (typeof value === 'function' && key !== '_rebindStaticMethod' && typeof parentKlass._rebindStaticMethod === 'function')
      value = parentKlass._rebindStaticMethod(key, value, klass);

    Object.defineProperty(klass, key, {
      writable: true,
      enumerable: false,
      configurable: true,
      value
    });
  }

  // Decend into parent and copy those static methods as well
  var nextParent = Object.getPrototypeOf(parentKlass);
  if (nextParent)
    copyStaticMethods(klass, nextParent);

  return klass;
}

module.exports = {
  memoize,
  memoizeModule,
  capitalize,
  regExpEscape,
  toNumber,
  generateUUID,
  castValueToPrimitive,
  parseURIParts,
  toQueryString,
  createResolvable,
  searchAndReplaceFactory,
  copyStaticMethods
};

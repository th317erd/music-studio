const utils = require('@root/base-utils');

module.exports = utils.memoizeModule(function(_globalOpts) {
  const globalOpts = _globalOpts || {},
        D = require('evisit-js-utils').data,
        U = require('evisit-js-utils').utils;

  class APIRoute {
    constructor(opts, routeName, apiBase) {
      Object.defineProperty(this, 'routeName', {
        writable: false,
        enumberable: false,
        configurable: false,
        value: routeName
      });

      Object.defineProperty(this, 'apiBase', {
        writable: false,
        enumberable: false,
        configurable: false,
        value: apiBase
      });

      D.extend(this, {
        method: 'GET'
      });

      if (opts) {
        D.extend(D.extend.DEEP|D.extend.FILTER, (key, val, obj, dstObj, dstVal, depth) => {
          if (depth === 0 && key === 'data')
            return false;

          return true;
        }, this, opts);

        this.data = opts.data;
      }
    }

    async getCacheObj(_cachePath, _cacheKey) {
      if (!this.apiBase.cacheEngine)
        return;

      var cacheEngine = this.apiBase.cacheEngine,
          cachePath = _cachePath,
          cacheKey = _cacheKey;

      if (arguments.length === 1) {
        cacheKey = cachePath;
        cachePath = this.cache;
      } else if (arguments.length === 0) {
        cacheKey = this.cacheKey;
        cachePath = this.cache;
      }

      if (!cachePath)
        return;

      if (!cacheKey)
        return;

      if (cacheKey instanceof Function)
        cacheKey = cacheKey.call(this);

      var finalCachePath = cachePath + '.' + cacheKey,
          ret = await cacheEngine.get(finalCachePath);

      if (ret && (this.cacheInvalid instanceof Function)) {
        var isInvalid = await this.cacheInvalid.call(this, ret, finalCachePath, cacheEngine);
        if (isInvalid)
          return;
      }

      return ret;
    }

    async getCache(_cachePath, _cacheKey) {
      var cacheObj = await this.getCacheObj(...arguments);
      return cacheObj;
    }

    async setCache(_cachePath, _cacheKey, _cacheGetter, _data) {
      if (!this.apiBase.cacheEngine)
        return;

      var cacheEngine = this.apiBase.cacheEngine,
          cachePath = _cachePath,
          cacheKey = _cacheKey,
          cacheGetter = _cacheGetter,
          data = _data;

      if (arguments.length === 3) {
        data = cacheGetter;
        cacheGetter = this.cacheGetter;
      } else if (arguments.length === 2) {
        data = cacheKey;
        cacheGetter = this.cacheGetter;
        cacheKey = cachePath;
        cachePath = this.cache;
      } else if (arguments.length === 1) {
        data = cachePath;
        cacheGetter = this.cacheGetter;
        cacheKey = this.cacheKey;
        cachePath = this.cache;
      }

      if (!cachePath)
        return;

      if (!cacheKey)
        return;

      if (cacheKey instanceof Function)
        cacheKey = cacheKey.call(this, data);

      if (U.instanceOf(cacheGetter, 'string')) {
        var cacheGetterPropKey = cacheGetter;
        cacheGetter = function(data) {
          return U.get(data, cacheGetterPropKey);
        };
      } else if (U.noe(cacheGetter)) {
        cacheGetter = function(data) {
          return data;
        };
      }

      var finalCachePath = cachePath + '.' + cacheKey,
          currentCache = await cacheEngine.get(finalCachePath),
          ret = (U.noe(data)) ? null : cacheGetter.call(this, data, currentCache, finalCachePath, cacheEngine);

      if (!U.noe(ret)) {
        if (!currentCache)
          currentCache = {};

        currentCache.value = ret;
        currentCache.ts = U.now();

        if (this.cacheUpdate instanceof Function)
          await this.cacheUpdate(ret, currentCache, cacheEngine);
        else
          await cacheEngine.set(finalCachePath, currentCache);
      } else {
        await cacheEngine.unset(finalCachePath);
      }

      return ret;
    }

    async clearCache(...args) {
      if (!this.apiBase.cacheEngine)
        return;

      var cacheEngine = this.apiBase.cacheEngine;
      if (args.length === 0)
        return await cacheEngine.clear();

      return await this.setCache.apply(this, args.slice(0, 2));
    }

    async before() {
    }

    async beforeSuccess(data) {
    }

    async success() {
    }

    async beforeError() {
    }

    async error() {
    }

    async complete() {
    }

    async always() {
    }

    abort() {
      this.cancelled = true;
    }

    header(_name, set) {
      if (arguments.length === 0)
        return;

      var headers = this.headers;
      if (!headers)
        return;

      if (U.noe(_name))
        return;

      var name = ('' + _name).toLowerCase(),
          keys = Object.keys(headers);

      for (var key of keys) {
        if (key.toLowerCase() === name) {
          if (arguments.length > 1) {
            headers[key] = set;
            return set;
          }

          return headers[key];
        }
      }
    }

    require(data) {
      for (var i = 1, il = arguments.length; i < il; i++) {
        var arg = arguments[i];
        if (U.get(data, arg) == null) {
          var msg = 'Required argument: ' + arg + ', not found for API route ' + this.routeName;
          throw new Error(msg);
        }
      }
    }

    async exec() {
      async function doOperation() {
        var result, newResult, alwaysCalled = false;
        try {
          //Prep query
          result = await this.before();
          if (this.cancelled) {
            //Operation canceled
            newResult = await this.always(result);
            if (newResult !== undefined)
              result = newResult;

            return result;
          }

          if (result === undefined || result === null) {
            var fakeData = this.fakeData || (this.apiBase.fakeData && this.apiBase.fakeData[this.routeName]);

            if (fakeData) {
              //Emulate data
              result = fakeData;
            } else {
              //Run query across network
              result = await this.apiBase.fetch.call(this.apiBase, this);
            }
          }

          //Handle success result
          var events = ['beforeSuccess', 'success', 'complete', 'always'];
          for (var i = 0, il = events.length; i < il; i++) {
            var eventName = events[i];

            if (eventName === 'always')
              alwaysCalled = true;

            newResult = await this[eventName](result);
            if (newResult !== undefined)
              result = newResult;
          }
        } catch (e) {
          if (alwaysCalled)
            throw e;

          if (this.debug)
            console.log('API error: ', e);

          result = e;

          //Handle error result
          var events = ['beforeError', 'error', 'complete', 'always'];
          for (var i = 0, il = events.length; i < il; i++) {
            var eventName = events[i];

            if (this.cancelled && (eventName === 'error' || eventName === 'complete'))
              continue;

            try {
              newResult = await this[eventName](result);
              if (newResult !== undefined)
                result = newResult;
            } catch (e) {
              result = e;
            }
          }

          if (result instanceof Error)
            throw result;
        }

        //Return final result from server
        return result;
      }

      if (this.cache && this.force !== true) {
        var cache = await this.getCache();
        if (!U.noe(cache) && cache.value) {
          if (cache.value instanceof Promise) {
            var finalValue = await cache.value;
            return D.clone(finalValue);
          }

          return D.clone(cache.value);
        }
      }

      var result = doOperation.call(this);

      if (this.cache) {
        this.setCache(result);

        result.then((finalResult) => {
          return this.setCache(D.clone(finalResult));
        }, () => {
          return this.setCache(null);
        });
      }

      return await result;
    }
  }

  class APIEngine {
    constructor(routeFactory, _opts) {
      var opts = _opts || {};

      Object.defineProperty(this, '_routes', {
        writable: false,
        enumberable: false,
        configurable: false,
        value: {}
      });

      if (routeFactory instanceof Function)
        routeFactory.call(this, this.registerRoute.bind(this));

      var internalCache = {};
      Object.defineProperty(this, '_cache', {
        writable: false,
        enumberable: false,
        configurable: false,
        value: internalCache
      });

      this.cacheEngine = {
        get: async function(path) {
          return U.get(internalCache, path);
        },
        set: async function(path, value) {
          return U.set(internalCache, path, value);
        },
        unset: async function(path) {
          return U.set(internalCache, path, null);
        }
      };
    }

    registerRoute(name, _parent, _builder) {
      var parent = _parent,
          builder = _builder;

      if (arguments.length === 2) {
        builder = parent;
        parent = this.baseRoute();
      } else if (U.instanceOf(parent, 'string')) {
        parent = this._routes[parent];
      }

      var routeKlass = builder.call(this, parent);
      if (!(routeKlass instanceof Function)) {
        routeKlass = class GenericRoute extends parent {
          constructor() {
            super(...arguments);

            D.extend(true, this, routeKlass);
          }
        };
      }

      var Klass = this._routes[name] = routeKlass,
          apiBase = this;

      //If route name starts with a capital, it can be used as a parent but can not be called
      if (name.match(/^[A-Z]/))
        return Klass;

      this[name] = async (opts) => {
        var instance = new Klass(opts || {}, name, apiBase);
        return await instance.exec();
      };

      return Klass;
    }

    async fetch() {
      return {};
    }

    route(name) {
      return this._routes[name];
    }

    baseRoute() {
      return APIRoute;
    }
  }

  return {
    APIRoute,
    APIEngine
  };
});

const fs = require('fs'),
      path = require('path'),
      stream = require('stream'),
      { throwHTTPError, memoizeModule } = require('../../base-utils');

module.exports = memoizeModule(function(_globalOpts) {
  const globalOpts = _globalOpts || {},
        U = require('evisit-js-utils').utils;

  const noop = () => {};

  class RouteBase {
    constructor(_context) {
      var context = _context || {};

      U.defineROProperty(this, 'context', undefined, () => context, noop);
      U.defineROProperty(this, 'request', undefined, () => context.request, noop);
      U.defineROProperty(this, 'hapi', undefined, () => context.hapi, noop);
      U.defineROProperty(this, 'server', undefined, () => context.httpServer, noop);
    }

    // This "jails" a path resolution request to a certain directory
    // if for any reason the final path is not of this directory (a child
    // path) than it will throw a 404 "not found" error
    safePathResolve(rootPath, ...parts) {
      try {
        var fullPath = path.resolve(...parts);
        fullPath = fs.realpathSync(path.normalize(fullPath));
        if (fullPath.substring(0, rootPath.length) !== rootPath)
          throw new Error('Invalid access');

        return fullPath;
      } catch (e) {
        this.throwError(404);
      }
    }

    async safeMethodCall(methodName, args, onlyMethods) {
      var klass = this.constructor;
      if (
        klass === RouteBase ||
        !methodName ||
        ('' + methodName).match(/^(_|get$|post$|put$|delete$)/) ||
        !klass.prototype.hasOwnProperty(methodName) ||
        typeof klass.prototype[methodName] !== 'function' ||
        (onlyMethods && onlyMethods.length && onlyMethods.indexOf(methodName) < 0)
      ) {
        this.throwError(404);
      }

      var method = klass.prototype[methodName];
      return await method.call(this, args);
    }

    getHTTPServer() {
      return this.server;
    }

    getApplication() {
      return this.getHTTPServer().getApplication();
    }

    getApplicationDatabase() {
      return this.getApplication().getDatabase();
    }

    response(_data, _opts) {
      var data = _data,
          opts = _opts || {};

      var resp = Object.assign({
        status: 200,
        data
      }, opts);

      // JSON response
      if (data instanceof stream.Readable)
        resp.type = 'stream';
      else if (data && data instanceof Object)
        resp.type = 'json';
      else
        resp.type = 'plain';

      return resp;
    }

    fullPath() {
      return this.context.request.path;
    }

    path(set) {
      if (arguments.length > 0)
        this.context.path = ('' + set);

      return this.context.path;
    }

    resourceID(set) {
      if (arguments.length > 0)
        this.context.resourceID = ('' + set);

      return this.context.resourceID;
    }

    throwError(...args) {
      return throwHTTPError(...args);
    }

    getHostURL() {
      return this.getHTTPServer().getHostURL();
    }
  }

  return {
    RouteBase
  };
});

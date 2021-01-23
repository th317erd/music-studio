const fs = require('fs'),
      path = require('path'),
      { memoizeModule } = require('../../base-utils');

module.exports = memoizeModule(function(_globalOpts) {
  const globalOpts                          = _globalOpts || {},
        { RouteBase }                       = require('./route-base')(globalOpts),
        { buildJavascriptSourceForClient }  = require('../resources/resource-utils')(globalOpts);

  class Resource extends RouteBase {
    getMimeTypeFromExtension(fileName) {
      var ext = path.extname(fileName).toLowerCase(),
          mimeTypeMap = {
            '.js': 'application/javascript'
          },
          mimeType = mimeTypeMap[ext];

      return (mimeType) ? mimeType : 'application/octet-stream';
    }

    async get({ params }) {
      var requestedPath = this.path(),
          rootJailedPath = path.resolve(__dirname, '../resources', 'root'),
          resourcePath = this.safePathResolve(rootJailedPath, rootJailedPath, requestedPath),
          debug = (('' + params['debug']).toLowerCase() === 'true');

      try {
        var stats = fs.lstatSync(resourcePath);
        if (!stats.isFile())
          this.throwError(404);
      } catch (e) {
        this.throwError(404);
      }

      try {
        var mimeType = this.getMimeTypeFromExtension(resourcePath),
            data;

        if (mimeType === 'application/javascript')
          data = await buildJavascriptSourceForClient.call(this, resourcePath, { DEV: debug });
        else
          data = fs.createReadStream(resourcePath);

        return this.response(data, {
          mimeType
        });
      } catch (e) {
        this.throwError(500, 'Unable to read resource');
      }
    }
  }

  return {
    Resource
  };
});

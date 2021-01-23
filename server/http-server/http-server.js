/* global Buffer */

const FS = require('fs'),
      PATH = require('path'),
      STREAM = require('stream');

const {
  memoizeModule,
  throwHTTPError,
  capitalize,
  generateUUID
} = require('../base-utils');

const ACCEPTABLE_ENCODINGS = ['ascii', 'utf8', 'utf16le', 'ucs2', 'base64', 'latin1', 'binary', 'hex'];

module.exports = memoizeModule(function(_globalOpts) {
  const globalOpts = _globalOpts || {};

  const Hapi = require('hapi'),
        SocketIO = require('socket.io'),
        U = require('evisit-js-utils').utils,
        { mkdirPathSync } = require('../utils')(globalOpts),
        { Logger } = require('../logger')(globalOpts),
        { RouteBase } = require('./routes/route-base')(globalOpts),
        { routes } = require('./routes')(globalOpts);

  class HTTPServer {
    constructor(application, _opts) {
      var opts = Object.assign({
        requestTimeout: (60 * 1000) * 5, // 5 minutes
        maxBodySize: (1024 * 1024) * 25, // 25mb
        uploadPath: '/tmp/music-studio'
      }, _opts || {});

      // Create upload path
      if (opts.uploadPath) {
        opts.uploadPath = PATH.join(opts.uploadPath, 'server-uploads');
        this.createFileUploadPath(opts.uploadPath);
      }

      U.defineROProperty(this, '_options', opts);
      U.defineROProperty(this, '_application', application);
      U.defineRWProperty(this, '_server', null);
      U.defineRWProperty(this, '_io', null);
    }

    createFileUploadPath(uploadPath) {
      mkdirPathSync(uploadPath);
    }

    getApplication() {
      return this._application;
    }

    getApplicationDatabase() {
      return this.getApplication().getDatabase();
    }

    formatRouteName(route) {
      return capitalize(('' + route).replace(/[^\w\d]+(\w)/g, function(m, p) {
        return p.toUpperCase();
      }));
    }

    createFileObjectFromField(readable) {
      var uploadPath = this._options.uploadPath;
      if (!uploadPath) {
        Logger.info('Aborting file upload because no "uploadPath" is specified on the HTTP Server options');
        return;
      }

      var originalFileName = U.get(readable, 'hapi.filename', 'unknown-file-name'),
          mimeType = U.get(readable, 'hapi.headers.content-type'),
          safeFileName = generateUUID(),
          fullPath = PATH.join(uploadPath, safeFileName);

      return new Promise((resolve) => {
        try {
          var writeStream = FS.createWriteStream(fullPath);
          writeStream.on('close', () => {
            var fileObj = {};
            Object.defineProperties(fileObj, {
              '_isFile': {
                writable: false,
                enumerable: false,
                configurable: false,
                value: true
              },
              'data': {
                enumerable: false,
                configurable: true,
                get: () => {
                  return FS.createReadStream(fileObj.filePath, 'binary');
                },
                set: () => {}
              },
              'size': {
                enumerable: false,
                configurable: true,
                get: () => {
                  var fullFilePath = fileObj.filePath,
                      stats = FS.statSync(fullFilePath);

                  return stats.size;
                },
                set: () => {}
              }
            });

            Object.assign(fileObj, {
              mimeType,
              filePath: fullPath,
              fileName: originalFileName
            });

            resolve(fileObj);
          }).on('error', (error) => {
            Logger.error(`Error while trying to receive file ${originalFileName} from client: ${error}`);
            throwHTTPError(500);
          });

          readable.on('error', (error) => {
            Logger.error(`Error while trying to receive file ${originalFileName} from client: ${error}`);
            throwHTTPError(500);
          }).pipe(writeStream);
        } catch (e) {
          Logger.error(`Error while receiving file ${originalFileName} from client: ${e.message} - ${e}`);
          throwHTTPError(500);
        }
      });
    }

    async parseFormDataRequest(request) {
      var payload = request.payload;
      if (!payload)
        return payload;

      var fields = Object.keys(payload),
          data = {};

      for (var i = 0, il = fields.length; i < il; i++) {
        var fieldName = fields[i],
            fieldValue = payload[fieldName];

        if (fieldValue instanceof STREAM.Readable)
          fieldValue = await this.createFileObjectFromField(fieldValue);

        data[fieldName] = fieldValue;
      }

      return data;
    }

    parseOtherRequest(request, contentType) {
      var payload = request.payload;
      if (!payload)
        return payload;

      return new Promise((resolve, reject) => {
        var body = [];

        payload.on('error', (err) => {
          reject(err);
        });

        payload.on('end', () => {
          var finalBody = Buffer.concat(body);
          if (contentType.match(/^application\/json$/i)) {
            try {
              finalBody = (!finalBody || !finalBody.length) ? {} : JSON.parse(('' + finalBody));
            } catch (e) {
              throwHTTPError(400);
            }
          } else {
            finalBody = ('' + finalBody);
          }

          resolve(finalBody);
        });

        payload.on('data', (chunk) => {
          body.push(chunk);
        });
      });
    }

    getRequestBody(request) {
      var contentType = U.get(request, 'headers.content-type', '');
      if (contentType.match(/^multipart\/form-data/i) || contentType.match(/^application\/x-www-form-urlencoded/i))
        return this.parseFormDataRequest(request, contentType);
      else
        return this.parseOtherRequest(request, contentType);
    }

    async handleRequest(request, hapi) {
      var { path, method } = request,
          allRoutes = routes,
          routeParts = { type: '', route: undefined, trailingPath: undefined };

      method = method.toLowerCase();

      ('' + path).replace(/^\/([^\/]+)(\/[^\/]+)?(\/.+)?$/, function(m, routeType, route, extra) {
        routeParts.type = routeType;
        routeParts.route = (route) ? route.replace(/^[\/]+/, '') : '';
        routeParts.trailingPath = (extra) ? extra.replace(/^[\/]+/, '') : undefined;
      });

      if (!routeParts.route)
        routeParts.route = 'index';

      var finalRouteKey = this.formatRouteName(routeParts.route),
          finalRoute = allRoutes[routeParts.type];

      // If route wasn't found, default to index
      if (!finalRoute || !finalRoute.hasOwnProperty(finalRouteKey)) {
        if (!routeParts.trailingPath)
          routeParts.trailingPath = routeParts.route;

        routeParts.resourceID = routeParts.route.split(/\//g)[0];

        routeParts.route = 'index';
        finalRouteKey = this.formatRouteName(routeParts.route);
        finalRoute = allRoutes[routeParts.type];
      }

      if (!finalRoute || !finalRoute.hasOwnProperty(finalRouteKey))
        throwHTTPError(404);

      Logger.info(`Handling request -> ${method.toUpperCase()} ${routeParts.type}:${finalRouteKey}${(routeParts.trailingPath) ? `/${routeParts.trailingPath}` : ''}`);

      var routeClass = finalRoute[finalRouteKey],
          routeInstance = new routeClass({
            httpServer: this,
            request,
            hapi,
            path: routeParts.trailingPath,
            resourceID: routeParts.resourceID
          });

      if (!(method in routeInstance) || method in RouteBase.prototype)
        throwHTTPError(404);

      var body = await this.getRequestBody(request);

      return await routeInstance[method]({
        method,
        params: request.query,
        body,
        headers: request.headers
      });
    }

    async defaultRouteHandler(request, hapi) {
      try {
        var response = await this.handleRequest(request, hapi);

        if (response.type === 'json') {
          return hapi.response({
            time: (new Date()).valueOf(),
            success: true,
            status: response.status,
            data: U.safeJSONStringify(response.data)
          }).code(response.status);
        } else if (response.type === 'stream' || response.type === 'buffer') {
          return hapi.response(response.data).code(response.status).header('Content-Type', response.mimeType);
        } else if (response.type === 'plain') {
          var data = response.data,
              resp = hapi.response((data == null) ? '' : ('' + data)).code(response.status);

          if (response.mimeType)
            resp.header('Content-Type', response.mimeType);

          return resp;
        }
      } catch (e) {
        var status = e.status || 500,
            errors = ([].concat(e.errors)).filter(Boolean);

        Logger.error(`[${request.method} ${request.path}]: ${e.message}\n${e.stack}`);

        return hapi.response({
          time: (new Date()).valueOf(),
          success: false,
          statusCode: status,
          errors
        }).code(status);
      }
    }

    initializeRoutes(server) {
      var options = this._options;

      server.route({
        method: [ 'GET' ],
        path: '/{path*}',
        config: {
          handler: this.defaultRouteHandler.bind(this),
          timeout: {
            server: options.requestTimeout,
            socket: options.requestTimeout + 1000
          }
        }
      });

      server.route({
        method: [ 'PUT', 'POST', 'DELETE' ],
        path: '/{path*}',
        config: {
          handler: this.defaultRouteHandler.bind(this),
          payload: {
            output    : 'stream',
            parse     : true,
            maxBytes  : options.maxBodySize
          },
          timeout: {
            server: options.requestTimeout,
            socket: options.requestTimeout + 1000
          }
        }
      });
    }

    async startWebSocketServer(httpServer) {
      var io = this._io = SocketIO(httpServer);
      io.on('connection', function (socket) {
        socket.emit('connected');
      });
    }

    async broadcastWebSocketEvent(eventName, data) {
      var io = this._io;
      if (!io)
        return;

      io.emit(eventName, (data != null) ? U.safeJSONStringify(data) : undefined);
    }

    async start() {
      var options = this._options;

      try {
        const server = this._server = Hapi.server({
          port: options.port,
          host: options.host
        });

        this.initializeRoutes(server);

        await server.start();
        Logger.info(`Server running at: ${server.info.uri}`);

        await this.startWebSocketServer(server.listener);
      } catch (error) {
        // If this port is in use, try another port
        if (error.errno === 'EACCES') {
          options.port = options.port + 1;
          return await this.start(options);
        }
      }
    }

    async stop() {
      var server = this._server,
          options = this._options,
          uploadPath = options.uploadPath;

      if (!server)
        return;

      this._server = null;

      try {
        var stopResponse = await server.stop({ timeout: 5000 });
      } catch (e) {
        stopResponse = e;
        Logger.error('Error while shutting down HTTP server: ', e);
      }

      if (uploadPath) {
        try {
          console.log('List files');
          var files = FS.readdirSync(uploadPath);
          console.log('Delete files');
          files.forEach((file) => {
            var fullFileName = PATH.join(uploadPath, file),
                stats = FS.statSync(fullFileName);

            if (!stats.isFile)
              return;

            try {
              FS.unlinkSync(fullFileName);
            } catch (e) {
              Logger.error(`Error while cleaning server file uploads: ${uploadPath}[${fullFileName}]: `, e);
            }
          });
          console.log('Done');
        } catch (e) {
          Logger.error(`Error while cleaning server file uploads: ${uploadPath}: `, e);
        }
      }

      if (stopResponse instanceof Error)
        throw stopResponse;

      return stopResponse;
    }

    getHostURL() {
      var opts = this._options;
      return `http://${opts.host}:${opts.port}`;
    }
  }

  return {
    HTTPServer
  };
});

require('./shims')();

const { memoizeModule } = require('./base-utils');

module.exports = memoizeModule(function(globalOpts) {
  const U                     = require('evisit-js-utils').utils,
        D                     = require('evisit-js-utils').data,
        { loadConfig }        = require('./utils')(globalOpts),
        { Logger }            = require('./logger')(globalOpts),
        { ApplicationSchema } = require('./schema')(globalOpts),
        { HTTPServer }        = require('./http-server')(globalOpts),
        { Database }          = require('./database')(globalOpts);

  class ApplicationServer {
    constructor(_opts) {
      var opts = _opts || {};

      U.defineROProperty(this, '_options', opts);
      U.defineROProperty(this, '_schema', new ApplicationSchema(this));

      // listen on SIGINT signal and gracefully stop the server
      process.on('SIGINT', async () => {
        var success = await this.stop();
        process.exit((success) ? 0 : 1);
      });
    }

    getApplicationSchema() {
      return this._schema;
    }

    loadConfig(...args) {
      return loadConfig(...args);
    }

    async createHTTPServer(_config) {
      var config = D.extend(true, {}, U.get(_config, 'http', {}), this._options.http || {});
      if (config.enabled === false)
        return null;

      var httpServer = new HTTPServer(this, config);
      await httpServer.start();

      return httpServer;
    }

    async createDatabase(_config) {
      var config = D.extend(true, {}, U.get(_config, 'database', {}), this._options.database || {});
      if (config.enabled === false)
        return null;

      var database = new Database(this, config);
      await database.start();

      database.on('model:created', (modelType, model) => {
        this.notifyClients('model:created', {
          type: modelType,
          data: model
        });
      });

      database.on('model:updated', (modelType, model) => {
        this.notifyClients('model:updated', {
          type: modelType,
          data: model
        });
      });

      database.on('model:destroyed', (modelType, model) => {
        this.notifyClients('model:destroyed', {
          type: modelType,
          data: model
        });
      });

      return database;
    }

    // Notify clients via websocket of events
    async notifyClients(eventName, data) {
      var httpServer = this.httpServer;
      if (!httpServer)
        return;

      httpServer.broadcastWebSocketEvent(eventName, data);
    }

    async start(_opts) {
      var config = this.loadConfig(_opts);

      var database = await this.createDatabase(config),
          httpServer = await this.createHTTPServer(config);

      Object.defineProperties(this, {
        'httpServer': {
          writable: true,
          enumerable: false,
          configurable: false,
          value: httpServer
        },
        'database': {
          writable: true,
          enumerable: false,
          configurable: false,
          value: database
        }
      });
    }

    async stop() {
      var hasError = false;

      Logger.info('Shutting down server!');

      var database = this.getDatabase();
      if (database) {
        try {
          await database.stop();
          Logger.debug('Successfully closed database connections!');
        } catch (e) {
          hasError = true;
          Logger.error(`Error while closing database connections: ${e.message}\n${e.stack}`);
        }
      }

      var httpServer = this.getHTTPServer();
      if (httpServer) {
        try {
          await httpServer.stop();
          Logger.debug('Successfully shut down HTTP server!');
        } catch (e) {
          hasError = true;
          Logger.error(`Error while shutting down HTTP server: ${e.message}\n${e.stack}`);
        }
      }

      Logger.debug('Successfully shut server!');

      return !hasError;
    }

    getHTTPServer() {
      return this.httpServer;
    }

    getDatabase() {
      return this.database;
    }
  }

  return {
    ApplicationServer
  };
});


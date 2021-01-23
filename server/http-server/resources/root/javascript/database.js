const utils = require('@root/base-utils');

module.exports = utils.memoizeModule(function(_globalOpts) {
  const globalOpts = _globalOpts || {},
        U = require('evisit-js-utils').utils,
        { ServerConnector } = require('./server-connector')(globalOpts),
        { QueryBuilder } = require('@root/base')(globalOpts);

  const noop = () => {};

  class ApplicationDatabase {
    constructor(application, _opts) {
      var opts = Object.assign({}, _opts || {});

      U.defineROProperty(this, '_options', opts);
      U.defineROProperty(this, '_application', application);
      U.defineROProperty(this, '_schema', undefined, () => application.getApplicationSchema(), noop);
      U.defineROProperty(this, '_connector', new ServerConnector(application, opts));
    }

    getConnector() {
      return this._connector;
    }

    getSchema() {
      return this._schema;
    }

    getApplication() {
      return this._application;
    }

    async start() {
      await this._connector.start();
    }

    async stop() {
      var connector = this._connector;
      if (!connector)
        return;

      connector.stop();
      connector = null;
    }

    _createRawQueryBuilder(type, onExec) {
      if (type instanceof QueryBuilder) {
        type.setOnExec(onExec);
        return type;
      } else {
        var query = new QueryBuilder({ onExec: onExec });
        if (type)
          query = query.model(type);

        return query;
      }
    }

    store() {
      throw new Error('Client can not call destroy directly');
    }

    query(type) {
      return this._createRawQueryBuilder(type, (query, opts) => {
        var connector = this.getConnector();
        if (!connector)
          return;

        return connector.query(this.getSchema(), query, opts);
      });
    }

    destroy(type) {
      throw new Error('Client can not call destroy directly');
    }
  }

  return {
    Database: ApplicationDatabase
  };
});


const utils = require('@root/base-utils');

module.exports = utils.memoizeModule(function(_globalOpts) {
  const globalOpts            = _globalOpts || {},
        { createAPILayer }    = require('./api')(globalOpts),
        U                     = require('evisit-js-utils').utils,
        { ApplicationSchema } = require('@root/schema')(globalOpts),
        { Database }          = require('./database')(globalOpts);

  class Application {
    constructor() {
      U.defineROProperty(this, '_schema', new ApplicationSchema(this));
      U.defineROProperty(this, 'endpoints', createAPILayer(this));
    }

    getApplicationSchema() {
      return this._schema;
    }

    async createDatabase() {
      var database = new Database(this);
      await database.start();

      return database;
    }

    getDatabase() {
      return this.database;
    }

    async start(_opts) {
      var database = await this.createDatabase();

      Object.defineProperty(this, 'database', {
        writable: true,
        enumerable: false,
        configurable: false,
        value: database
      });
    }
  }

  return Object.assign({}, {
    Application
  });
});

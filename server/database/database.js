const { memoizeModule } = require('../base-utils');

module.exports = memoizeModule(function(_globalOpts) {
  const globalOpts = _globalOpts || {},
        U = require('evisit-js-utils').utils,
        EventEmitter  = require('events'),
        { SQLiteConnector } = require('../connectors')(globalOpts),
        { Logger } = require('../logger')(globalOpts),
        { QueryBuilder } = require('../base')(globalOpts),
        { DatabaseOperations } = require('./database-operations')(globalOpts);

  const noop = () => {};

  class ApplicationDatabase extends EventEmitter {
    constructor(application, _opts) {
      super();

      var opts = Object.assign({}, _opts || {});
      if (!opts.connectionString)
        throw new Error('"connectionString" is a required key for instantiating ApplicationDatabase');

      U.defineROProperty(this, '_options', opts);
      U.defineROProperty(this, '_application', application);
      U.defineROProperty(this, '_schema', undefined, () => application.getApplicationSchema(), noop);
      U.defineROProperty(this, '_connector', this.initializeConnector(opts));
    }

    initializeConnector(opts) {
      const getTypeFromSchemaCode = (modelID) => {
        if (!modelID)
          return;

        var schemaCode = ('' + modelID).replace(/^(\w+):.*$/g, '$1'),
            schema = this.getSchema(),
            modelSchema = (schema && schema.getModelSchemaFromSchemaCode(schemaCode));

        if (!modelSchema)
          return;

        return modelSchema.getModelName();
      };

      var connector = new SQLiteConnector(opts);

      connector.on('model:created', (model) => {
        var modelType = getTypeFromSchemaCode(model.__primaryKey);
        if (!modelType)
          return;

        this.emit('model:created', modelType, model);
      });

      connector.on('model:updated', (model) => {
        var modelType = getTypeFromSchemaCode(model.__primaryKey);
        if (!modelType)
          return;

        this.emit('model:updated', modelType, model);
      });

      connector.on('model:destroyed', (model) => {
        var modelType = getTypeFromSchemaCode(model.__primaryKey);
        if (!modelType)
          return;

        this.emit('model:destroyed', modelType, model);
      });

      return connector;
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

    async initializeDatabase() {
      var schema = this._schema,
          models = schema.getModelSchemas(),
          modelNames = Object.keys(models);

      for (var i = 0, il = modelNames.length; i< il; i++) {
        var modelName = modelNames[i],
            schemaDefinition = schema.getModelSchema(modelName);

        if (!schemaDefinition)
          continue;

        await schemaDefinition.callEventCallbacks('initialize', { database: this });
      }
    }

    async createDatabaseStructure() {
      try {
        await this._connector.buildTablesFromSchema(this._schema);
        await this.initializeDatabase();
      } catch (e) {
        const error = e;
        debugger;
      }
    }

    async start() {
      await this._connector.start();
      await this.createDatabaseStructure();
    }

    async stop() {
      var connector = this._connector;
      if (!connector)
        return;

      connector.stop();
      connector = null;
    }

    async store(...args) {
      return await this._connector.store(...args);
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

    query(type) {
      return this._createRawQueryBuilder(type, (query, opts) => {
        var connector = this.getConnector();
        if (!connector)
          return;

        return connector.query(this.getSchema(), query, opts);
      });
    }

    destroy(typeOrModels, _opts) {
      if (!typeOrModels)
        return;

      if (typeof typeOrModels === 'string' || typeOrModels instanceof String || typeOrModels instanceof QueryBuilder) {
        // Returns QueryBuilder
        return this._createRawQueryBuilder(typeOrModels, async (query, opts) => {
          var connector = this.getConnector();
          if (!connector)
            return;

          return connector.destroyByQuery(this.getSchema(), query, Object.assign({}, _opts || {}, opts || {}));
        });
      }

      var connector = this.getConnector();
      if (!connector)
        return;

      // Returns promise
      return connector.destroy(this.getSchema(), typeOrModels, _opts);
    }

    async exportAll() {
      return await DatabaseOperations.exportAll(this);
    }

    async export(query) {
      return await DatabaseOperations.export(this, query);
    }

    async importAll(archive) {
      return await DatabaseOperations.importAll(this, archive);
    }

    async import(csv) {
      return await DatabaseOperations.import(this, csv);
    }

    async transaction(callback) {
      var connector = this.getConnector();
        if (!connector)
          return;

      return await connector.transaction(callback);
    }
  }

  return {
    Database: ApplicationDatabase
  };
});


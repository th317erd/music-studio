const utils = require('@root/base-utils');

module.exports = utils.memoizeModule(function(_globalOpts) {
  const globalOpts = _globalOpts || {},
        U = require('evisit-js-utils').utils,
        { LazyCollection } = require('@root/base/lazy-collection')(globalOpts);

  class ServerConnector {
    constructor(application, _opts) {
      var opts = _opts || {};

      U.defineROProperty(this, '_options', opts);
      U.defineROProperty(this, '_application', application);
    }

    getApplication() {
      return this._application;
    }

    async start() {

    }

    async stop() {

    }

    buildQueryParts(schema, query, _opts) {
      var opts = _opts || {},
          modelNames = query.getAllTypes(),
          models = modelNames.map((modelName) => {
            var schemaDefinition = schema.getModelSchema(modelName);
            if (!schemaDefinition)
              throw new TypeError(`Model type "${modelName}" not defined in schema`);

            var modelFields = schemaDefinition.getFields(),
                fieldNames = Object.keys(modelFields);

            return {
              fieldNames,
              fields: fieldNames.map((fieldName) => {
                return `${modelName}.${fieldName}`;
              }),
              name: modelName,
              schema: schemaDefinition
            };
          });

      return {
        models,
        modelNames,
        fieldNames: [].concat(...models.map((table) => table.fieldNames)),
        fields: [].concat(...models.map((table) => table.fields))
      };
    }

    async query(schema, query, _opts) {
      var app = this.getApplication();
      if (!app)
        throw new Error('Query failed: can not find application to query through');

      var endpoints = app.endpoints,
          opts = _opts || {},
          { modelNames } = this.buildQueryParts(schema, query, opts),
          modelName = modelNames[0];

      if (!modelName)
        throw new Error('Can not query: unknown data type.');

      var items = await endpoints[`search${utils.capitalize(modelName)}s`]({ query });
      return (items) ? LazyCollection.from(items) : new LazyCollection();
    }
  }

  return {
    ServerConnector
  };
});

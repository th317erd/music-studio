const { memoizeModule } = require('../base-utils');

module.exports = memoizeModule(function(_globalOpts) {
  const globalOpts = _globalOpts || {},
        U = require('evisit-js-utils').utils,
        { Schema } = require('./schema-base')(globalOpts),
        { PreferenceSchemaDefinition } = require('./preference')(globalOpts),
        models = require('../models')(globalOpts);

  class ApplicationSchema extends Schema {
    constructor(application, ...args) {
      super(application, ...args);

      U.defineRWProperty(this, '_modelClasses', {});

      this.addModelSchema('preference', PreferenceSchemaDefinition, 'PR');

      Object.keys(models).forEach((modelName) => {
        if (modelName.match(/^(ModelBase)$/))
          return;

        var modelClass = models[modelName];
        this.addModelClass(modelClass.getFullModelName(), modelClass);
      });
    }

    getModelClass(name) {
      return this._modelClasses[name];
    }

    getModelNames() {
      return Object.keys(this._modelClasses);
    }

    addModelClass(name, modelClass) {
      if (typeof modelClass.schema !== 'function')
        U.defineRWProperty(modelClass, 'schema', () => this.getModelSchema(name));

      if (typeof modelClass.schemaCode !== 'function')
        U.defineRWProperty(modelClass, 'schemaCode', () => (this.getModelSchema(name).getSchemaCode()));

      if (typeof modelClass.create !== 'function')
        U.defineRWProperty(modelClass, 'create', (...args) => new modelClass(...args));

      this._modelClasses[name] = modelClass;
    }
  }

  return {
    ApplicationSchema
  };
}, 1);

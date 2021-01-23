const base64                = require('base-64'),
      { toNumber, memoizeModule } = require('../../base-utils');

const DEFAULT_MAX_LIMIT = 100;

module.exports = memoizeModule(function(_globalOpts) {
  const globalOpts = _globalOpts || {},
        U = require('evisit-js-utils').utils,
        { RouteBase } = require('./route-base')(globalOpts),
        { QueryBuilder } = require('../../base/query-builder')(globalOpts);

  class CRUDRouteBase extends RouteBase {
    constructor(_context, modalName, _opts) {
      super(_context);

      var schema = this.server.getApplication().getApplicationSchema(),
          schemaDefinition = schema.getModelSchema(modalName);

      if (!schemaDefinition)
        throw new Error(`Unable to find valid model schema for ${modalName}`);

      var opts = Object.assign({}, _opts || {});
      U.defineROProperty(this, '_options', opts);
      U.defineROProperty(this, '_schema', schema);
      U.defineROProperty(this, '_schemaDefinition', schemaDefinition);
    }

    getModelClass() {
      var modelName = this.getModelName(),
          modelClass = this._schema.getModelClass(modelName);

      if (!modelClass)
        throw new Error(`Unable to find valid model class for ${modelName}`);

      return modelClass;
    }

    getModelName() {
      return this._schemaDefinition.name;
    }

    getSchemaDefinition() {
      return this._schemaDefinition;
    }

    // Create a new model and validate it
    createNewModel(data) {
      var modelClass = this.getModelClass(),
          model = modelClass.create(data);

      // Validate model
      var validationErrors = model.validate();
      if (validationErrors)
        this.throwError(400, 'Validation error', validationErrors);

      return model;
    }

    // Update a model, but only allowable fields are updated
    updateModel(data, model) {
      var schemaDefinition = this.getSchemaDefinition(),
          fields = schemaDefinition.getFields(),
          fieldNames = Object.keys(fields);

      for (var i = 0, il = fieldNames.length; i < il; i++) {
        var fieldName = fieldNames[i];
        if (!data.hasOwnProperty(fieldName) || !schemaDefinition.isFieldUpdatable(fieldName))
          continue;

        model[fieldName] = data[fieldName];
      }

      return model;
    }

    getRequestQuery({ params, body }, databaseOperation = 'query') {
      var database = this.getApplicationDatabase();
      if (!database)
        this.throwError(500, 'No available database');

      var query = params.query || (body && body.query),
          requestPath = this.path(),
          sorter = (items) => items;

      if (!U.noe(requestPath) || query) {
        if (!query) {
          // Build id list query
          // Was a single ID or list of IDs requested?
          var modelClass = this.getModelClass(),
              modelSchema = modelClass.schema(),
              primaryKeyField = modelSchema.getPrimaryKeyField(),
              primaryKeyFieldName = (primaryKeyField && primaryKeyField.name) || 'id',
              ids = requestPath.replace(/^([^\\\/]+).*$/, '$1').split(',').map((id) => ('' + id).trim());

          query = database[databaseOperation](this.getModelName())[primaryKeyFieldName].oneOf(ids).finalize();

          // Sort final items by order ids were specified
          sorter = (items) => {
            if (!items || items.length < 2)
              return items;

            var itemMap = items.reduce((obj, item) => (obj[item[primaryKeyFieldName]] = item) && obj, {});
            return ids.map((id) => itemMap[id]);
          };
        } else {
          // Use query from client
          query = database[databaseOperation](QueryBuilder.unserialize(base64.decode(query).toString()));
        }
      } else {
        // Otherwise get everything
        var limit = toNumber(params.limit, 0),
            offset = toNumber(params.offset, 0),
            order = params.order;

        if (!limit)
          limit = DEFAULT_MAX_LIMIT;

        query = database[databaseOperation](this.getModelName()).limit(limit).offset(offset);

        if (order)
          query = query.order(order);

        query = query.finalize();
      }

      return { database, query, sorter };
    }

    serializeModels(models) {
      if (!models)
        return models;

      if (!Array.isArray(models))
        return models.onSerialize();

      return models.map((model) => model.onSerialize());
    }

    // Get models
    async get({ params }) {
      var { query, sorter } = this.getRequestQuery({ params }, 'query');
      if (!query.limit())
        query.limit(DEFAULT_MAX_LIMIT);

          // Fetch count
      var totalItems = await query.exec({ onlyCount: true }),
          // Now fetch items
          items = sorter(await query.all());

      return this.response({
        total: totalItems,
        count: items.length,
        limit: query.limit(),
        offset: query.offset(),
        items: this.serializeModels(items)
      });
    }

    // Create models
    async post({ body }) {
      var isArray = Array.isArray(body),
          incomingItems = (isArray) ? body : [body],
          database = this.getApplicationDatabase();

      if (!database)
        this.throwError(500, 'No available database');

      var models = [];
      for (var i = 0, il = incomingItems.length; i < il; i++) {
        var data = incomingItems[i];
        models.push(this.createNewModel(data));
      }

      await database.store(models);

      return this.response({
        total: incomingItems.length,
        count: models.length,
        items: this.serializeModels(models)
      });
    }

    // Update models
    async put({ params, body }) {
      var isArray = Array.isArray(body),
          incomingItems = (isArray) ? body : [body],
          modelClass = this.getModelClass(),
          modelSchema = modelClass.schema(),
          primaryKeyField = modelSchema.getPrimaryKeyField(),
          primaryKeyFieldName = (primaryKeyField && primaryKeyField.name) || 'id',
          force = (params.force || params.force === 'true'),
          database = this.getApplicationDatabase();

      if (!database)
        this.throwError(500, 'No available database');

      var updateIDs = incomingItems.map((item, index) => {
            var primaryKeyValue = item[primaryKeyFieldName];
            if (U.noe(primaryKeyValue))
              this.throwError(400, `Update requested but received no primary key (id) at index ${index}`);

            return primaryKeyValue;
          }),
          query = database.query(this.getModelName())[primaryKeyFieldName].oneOf(updateIDs).finalize(),
          items = await query.all(),
          createdItems = [];

      incomingItems.forEach((incoming) => {
        var item = items.find((thisItem) => (thisItem[primaryKeyFieldName] === incoming[primaryKeyFieldName]));
        if (!item) {
          if (force)
            createdItems.push(this.createNewModel(incoming));
          else
            this.throwError(400, `Unable to find requested model to update: ${incoming[primaryKeyFieldName]}`);
        } else {
          this.updateModel(incoming, item);
        }
      });

      await database.store(items.concat(createdItems), { allowUpdate: true });

      return this.response({
        total: incomingItems.length,
        count: createdItems.length,
        items: this.serializeModels((createdItems.length) ? createdItems : undefined)
      });
    }

    // Delete models
    async delete({ params, body }) {
      var { query, sorter } = this.getRequestQuery({ params, body }, 'destroy'),
          // Fetch count
          totalItems = await query.exec({ onlyCount: true }),
          // Now delete items
          items = sorter(await query.all());

      return this.response({
        total: totalItems,
        count: items.length,
        limit: query.limit(),
        offset: query.offset(),
        items: this.serializeModels(items)
      });
    }
  }

  return {
    CRUDRouteBase
  };
});

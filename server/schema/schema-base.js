const { generateUUID, memoizeModule } = require('../base-utils');

module.exports = memoizeModule(function(_globalOpts) {
  const globalOpts = _globalOpts || {},
        moment = require('moment'),
        U = require('evisit-js-utils').utils,
        { Logger } = require('../logger')(globalOpts),
        { LazyItem, LazyCollection } = require('../base/lazy-collection')(globalOpts);

  var internalFieldIDCounter = 1;

  class SchemaDefinition {
    constructor(parentSchema, name, schemaCode) {
      U.defineROProperty(this, 'schema', parentSchema);
      U.defineROProperty(this, 'operations', []);
      U.defineROProperty(this, 'events', {});
      U.defineROProperty(this, 'schemaCode', schemaCode);
      U.defineRWProperty(this, 'name', name);
      U.defineRWProperty(this, '_fieldCache', null);
      U.defineRWProperty(this, '_individualFieldCache', {});
    }

    getMasterSchema() {
      return this.schema;
    }

    getModelName() {
      return this.name;
    }

    generateUUID() {
      return generateUUID();
    }

    getSchema() {
      return this.schema;
    }

    getSchemaCode() {
      return this.schemaCode;
    }

    getApplication() {
      var schema = this.getSchema();
      if (!schema)
        return null;

      return schema.getApplication();
    }

    invalidateFieldCache() {
      this._fieldCache = null;
    }

    getTableName() {
      return this.name;
    }

    sizeOfID(modelName) {
      // two code identifier plus colon plus 36 char unique id
      return 3 + 36;
    }

    async callEventCallbacks(eventType, _opts) {
      var opts = _opts || {},
          events = this.events,
          boundEvents = events[eventType];

      if (!boundEvents || !boundEvents.length)
        return;

      for (var i = 0, il = boundEvents.length; i < il; i++) {
        var callback = boundEvents[i];
        if (typeof callback !== 'function')
          continue;

        await callback.call(this, Object.assign({}, opts, { schemaType: this, schema: this.getSchema() }));
      }
    }

    onDatabaseInitialize(callback) {
      var events = this.events,
          initEvents = events.initialize;

      if (!initEvents)
        initEvents = events.initialize = [];

      initEvents.push(callback);
    }

    _addRelationalField(modelName, name, _opts) {
      this.getSchema()._addRelationalField(modelName, name, _opts);
    }

    addField(name, _opts) {
      this.invalidateFieldCache();

      this.operations.push({
        type: 'add',
        name: name,
        value: (_opts || {})
      });
    }

    removeField(name) {
      this.invalidateFieldCache();

      this.operations.push({
        type: 'remove',
        name: name
      });
    }

    _removeRelationalField(modelName, name) {
      this.getSchema()._removeRelationalField(modelName, name);
    }

    renameField(oldName, newName) {
      this.invalidateFieldCache();

      this.operations.push({
        type: 'rename',
        oldName: oldName,
        name: newName
      });
    }

    _renameRelationalField(modelName, oldName, newName) {
      this.getSchema()._renameRelationalField(modelName, oldName, newName);
    }

    _belongsTo({ model, modelField, field, through, throughField }) {
      function getOwnerID() {
        var owner = this.getRawValue(field);

        // If it is a LazyItem and it is available then get it
        if (owner instanceof LazyItem) {
          if (owner.loaded())
            owner = owner.value();
          else
            owner = null;
        }

        if (!owner)
          return (this[ownerIDField] || null);

        var schemaDefinition = owner.schema(),
            primaryKeyField = (schemaDefinition) ? schemaDefinition.getPrimaryKeyField() : null,
            primaryKeyFieldName = (primaryKeyField && primaryKeyField.name) || 'id';

        if (!primaryKeyFieldName)
          return (this[ownerIDField] || null);

        return (owner && owner[primaryKeyFieldName]);
      }

      function getOwnerOrder() {
        var owner = this.getRawValue(field);

        // If it is a LazyItem and it is available then get it
        if (owner instanceof LazyItem) {
          if (owner.loaded())
            owner = owner.value();
          else
            owner = null;
        }

        if (!owner)
          return (this[ownerOrderField] || 0);

        var ownerField = owner[modelField];
        if (ownerField instanceof LazyCollection)
          ownerField = ownerField.loadedItems(true);

        if (!ownerField || !Array.isArray(ownerField))
          return (this[ownerOrderField] || 0);

        return ownerField.indexOf(this);
      }

      const thisThroughField = (through && throughField) ? throughField : ((through) ? `${field}_${model}` : null),
            throughFieldPK = (thisThroughField) ? `${thisThroughField}_id` : undefined,
            throughFieldOrder = (thisThroughField) ? `${thisThroughField}_order` : undefined,
            relationField = (thisThroughField) ? thisThroughField : field,
            ownerIDField = `${relationField}_id`,
            ownerOrderField = `${relationField}_order`,
            addField = (through) ? this._addRelationalField.bind(this, through) : this.addField.bind(this);

      this.addField(field, {
        type: model,
        relation: 'owner',
        relationField: modelField,
        ownerIDField,
        ownerOrderField,
        through,
        throughField: thisThroughField,
        throughFieldPK,
        throughFieldOrder
      });

      if (through) {
        addField(relationField, {
          type: model,
          relation: 'owner',
          relationField: modelField,
          ownerIDField,
          ownerOrderField,
          through,
          throughField: thisThroughField,
          throughFieldPK,
          throughFieldOrder
        });
      }

      this.addField(ownerIDField, {
        foreignKey: true,
        type: 'string',
        max: 64,
        nullable: true,
        relationField: modelField,
        value: getOwnerID,
        onBeforeStore: getOwnerID,
        through,
        throughField: thisThroughField,
        throughFieldPK,
        throughFieldOrder,
        alwaysAllowUpdate: (!!throughField)
      });

      this.addField(ownerOrderField, {
        type: 'integer',
        nullable: true,
        relationField: modelField,
        value: getOwnerOrder,
        onBeforeStore: getOwnerOrder,
        through,
        throughField: thisThroughField,
        throughFieldPK,
        throughFieldOrder,
        alwaysAllowUpdate: (!!throughField)
      });
    }

    belongsTo(args) {
      return this._belongsTo(args);
    }

    _hasMany({ model, modelField, field, through, throughField }) {
      var thisThroughField = (through && throughField) ? throughField : ((through) ? `${field}_${model}` : undefined),
          throughFieldPK = (thisThroughField) ? `${thisThroughField}_id` : undefined,
          throughFieldOrder = (thisThroughField) ? `${thisThroughField}_order` : undefined;

      this.addField(field, {
        type: model,
        relation: 'has_many',
        relationField: modelField,
        through,
        throughField: thisThroughField,
        throughFieldPK,
        throughFieldOrder
      });

      if (through) {
        var relationField = (thisThroughField) ? thisThroughField : field,
            ownerIDField = `${relationField}_id`,
            ownerOrderField = `${relationField}_order`,
            addField = (through) ? this._addRelationalField.bind(this, through) : this.addField.bind(this)

        addField(ownerIDField, {
          foreignKey: true,
          type: 'string',
          max: 64,
          nullable: true,
          relationField: modelField,
          through,
          throughField: thisThroughField,
          throughFieldPK,
          throughFieldOrder,
          alwaysAllowUpdate: (!!throughField)
        });

        addField(ownerOrderField, {
          type: 'integer',
          nullable: true,
          relationField: modelField,
          through,
          throughField: thisThroughField,
          throughFieldPK,
          throughFieldOrder,
          alwaysAllowUpdate: (!!throughField)
        });
      }
    }

    hasMany(args) {
      return this._hasMany(args);
    }

    filterFields(fields, _opts) {
      var opts = _opts || {},
          fieldNames = Object.keys(fields),
          finalFields = {};

      for (var i = 0, il = fieldNames.length; i < il; i++) {
        var fieldName = fieldNames[i],
            field = fields[fieldName];

        if (field.virtual && opts.virtual !== true)
          continue;

        if (field.relation && opts.relations !== true)
          continue;

        finalFields[fieldName] = field;
      }

      return finalFields;
    }

    getFields(_opts) {
      if (this._fieldCache)
        return this.filterFields(this._fieldCache, _opts);

      var fields = {},
          operations = this.operations,
          hasPrimaryKey = false;

      // Run through each operation resulting in a final set of fields
      for (var i = 0, il = operations.length; i < il; i++) {
        var op = operations[i];
        if (!op)
          continue;

        if (op.type === 'add') {
          var name = op.name;

          if (fields.hasOwnProperty(name))
            throw new Error(`Requested field ${name} be added, but field ${name} is already defined!`);

          var field = fields[name] = Object.assign({}, op.value, {
            model: this.name,
            name: name,
            id: internalFieldIDCounter++
          });

          if (field.type === 'date' && !field.hasOwnProperty('onSerialize')) {
            field.onSerialize = function(value, field) {
              return moment(value).format();
            };
          }

          if (field.type === 'date' && !field.hasOwnProperty('onValidate')) {
            field.onValidate = function(value, fieldName, field) {
              if (!value.isValid())
                return `${field.model}.${fieldName}: invalid date`;
            };
          }

          if (!field.primaryKey)
            field.primaryKey = false;

          if (field.nullable == null)
            field.nullable = true;

          if (field.type === 'boolean')
            field.max = 1;

          if (!field.max)
            field.max = undefined;

          if (field.type === 'string' && !field.max)
            field.max = 255;

          if (field.primaryKey)
            hasPrimaryKey = true;
        } else if (op.type === 'rename') {
          var name = op.name,
              oldName = op.oldName,
              field = fields[oldName];

          if (!field)
            throw new Error(`Requested field ${oldName} be renamed to ${name}, but field ${oldName} not found!`);

          // Update name
          field.name = name;

          // Update hash keys
          delete fields[oldName];
          fields[name] = field;
        } else if (op.type === 'remove') {
          var name = op.name;

          if (!fields.hasOwnProperty(name))
            throw new Error(`Requested field ${name} be removed, but field ${name} not found!`);

          delete fields[name];
        }
      }

      this._fieldCache = fields;
      this._individualFieldCache = {};

      if (!this.getPrimaryKeyField()) {
        field = this.getField('id');
        if (field)
          field.primaryKey = true;
      }

      return this.filterFields(fields, _opts);
    }

    getField(name) {
      var fields = this.getFields({ virtual: true, relations: true });
      return fields[name];
    }

    findField(cb, _opts) {
      var fields = this.getFields(_opts),
          fieldNames = Object.keys(fields);

      for (var i = 0, il = fieldNames.length; i < il; i++) {
        var fieldName = fieldNames[i],
            field = fields[fieldName];

        if (cb(field))
          return field;
      }
    }

    getDefaultOrderByField() {
      if (this._individualFieldCache['defaultOrderBy'])
        return this._individualFieldCache['defaultOrderBy'];

      var field = this.findField((field) => field.defaultOrderBy);
      this._individualFieldCache['defaultOrderBy'] = field;

      return field;
    }

    getPrimaryKeyField() {
      if (this._individualFieldCache['primaryKey'])
        return this._individualFieldCache['primaryKey'];

      var field = this.findField((field) => field.primaryKey);
      this._individualFieldCache['primaryKey'] = field;

      return field;
    }

    isFieldUpdatable(fieldName) {
      var field = this.getField(fieldName);
      if (!field)
        return false;

      return (!field.primaryKey && field.updatable !== false);
    }
  }

  class Schema {
    constructor(application) {
      U.defineROProperty(this, '_application', application);
      U.defineROProperty(this, '_modelSchemas', {});
      U.defineROProperty(this, 'operations', []);
      U.defineRWProperty(this, '_modelCache', null);
      U.defineRWProperty(this, '_relationalFields', {});
    }

    getApplication() {
      return this._application;
    }

    _getModelRelationalFields(modelName) {
      // Model is already defined... directly return model schema operations
      var modelSchema = this._modelSchemas[modelName];
      if (modelSchema)
        return modelSchema.operations;

      // Model is not yet defined, return a placeholder for model schema operations (to be added later)
      var relationalFields = this._relationalFields,
          modelRelationalFields = relationalFields[modelName];

      if (!modelRelationalFields)
        modelRelationalFields = relationalFields[modelName] = [];

      return modelRelationalFields;
    }

    _addRelationalField(modelName, name, _opts) {
      var modelRelationalFields = this._getModelRelationalFields(modelName);
      modelRelationalFields.push({
        type: 'add',
        name: name,
        value: (_opts || {})
      });
    }

    _removeRelationalField(modelName, name) {
      var modelRelationalFields = this._getModelRelationalFields(modelName);
      modelRelationalFields.push({
        type: 'remove',
        name: name
      });
    }

    _renameRelationalField(modelName, oldName, newName) {
      var modelRelationalFields = this._getModelRelationalFields(modelName);
      modelRelationalFields.push({
        type: 'rename',
        oldName: oldName,
        name: newName
      });
    }

    invalidateModelSchemaCache() {
      this._modelCache = null;
    }

    addModelSchema(name, DefinitionClass, schemaCode) {
      this.invalidateModelSchemaCache();

      var modelSchemaDefinition = new DefinitionClass(this, name, schemaCode),
          modelRelationalFields = this._getModelRelationalFields(name);

      if (modelRelationalFields.length) {
        modelSchemaDefinition.operations.push.apply(modelSchemaDefinition.operations, modelRelationalFields);
        this._relationalFields[name] = null;
      }

      this._modelSchemas[name] = modelSchemaDefinition;

      this.operations.push({
        type: 'add',
        name: name,
        schemaCode,
        value: modelSchemaDefinition
      });
    }

    removeModelSchema(name, schemaCode) {
      this.invalidateModelSchemaCache();

      this.operations.push({
        type: 'remove',
        name: name,
        schemaCode
      });
    }

    renameModelSchema(oldName, newName, oldSchemaCode, newSchemaCode) {
      this.invalidateModelSchemaCache();

      this.operations.push({
        type: 'rename',
        oldName: oldName,
        name: newName,
        oldSchemaCode,
        schemaCode: newSchemaCode
      });
    }

    getModelSchemas() {
      if (this._modelCache)
        return this._modelCache;

      var models = {},
          operations = this.operations;

      // Run through each operation resulting in a final set of fields
      for (var i = 0, il = operations.length; i < il; i++) {
        var op = operations[i];
        if (!op)
          continue;

        if (op.type === 'add') {
          var name = op.name,
              schemaCode = op.schemaCode;

          if (models.hasOwnProperty(name))
            throw new Error(`Requested model ${name} be added, but model ${name} is already defined!`);

          models[name] = op.value;
          U.defineRWProperty(models, `###schemaCode###:${schemaCode}`, op.value);
        } else if (op.type === 'rename') {
          var name = op.name,
              oldName = op.oldName,
              schemaCode = op.schemaCode,
              oldSchemaCode = op.oldSchemaCode,
              model = models[oldName];

          if (!model)
           throw new Error(`Requested model ${oldName} be renamed to ${name}, but model ${oldName} not found!`);

          // Update name
          model.name = name;

          // Update hash keys
          delete models[oldName];
          delete models[`###schemaCode###:${oldSchemaCode}`];

          models[name] = model;
          U.defineRWProperty(models, `###schemaCode###:${schemaCode}`, op.value);
        } else if (op.type === 'remove') {
          var name = op.name,
              schemaCode = op.schemaCode;

          if (!models.hasOwnProperty(name))
            throw new Error(`Requested model ${name} be removed, but model ${name} not found!`);

          delete models[name];
          delete models[`###schemaCode###:${schemaCode}`];
        }
      }

      this._modelCache = models;
      return models;
    }

    getRootSchemaName(fullName) {
      return ('' + fullName).replace(/^(.*):.*$/g, '$1');
    }

    getModelSchema(name) {
      var models = this.getModelSchemas();
      return models[this.getRootSchemaName(name)];
    }

    getModelSchemaFromSchemaCode(schemaCode) {
      var models = this.getModelSchemas();
      return models[`###schemaCode###:${schemaCode}`];
    }
  }

  return {
    SchemaDefinition,
    Schema
  };
});

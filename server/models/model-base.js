const { toNumber, memoizeModule } = require('../base-utils');

module.exports = memoizeModule(function(_globalOpts) {
  const globalOpts = _globalOpts || {},
        U = require('evisit-js-utils').utils,
        moment = require('moment'),
        { Logger } = require('../logger')(globalOpts),
        { LazyCollection, LazyItem } = require('../base')(globalOpts);

  class ModelBase {
    schema() {
      return this.constructor.schema();
    }

    getApplication() {
      return this.schema().getApplication();
    }

    getMasterSchema() {
      return this.schema().getSchema();
    }

    getSchemaCode() {
      return this.schema().getSchemaCode();
    }

    getApplicationDatabase() {
      var app = this.getApplication();
      if (!app)
        return null;

      return app.getDatabase();
    }

    getModelName() {
      return this.constructor.getModelName();
    }

    getFullModelName() {
      return (typeof this.constructor.getFullModelName === 'function') ? this.constructor.getFullModelName() : this.constructor.getModelName();
    }

    constructor(_data) {
      var schemaDefinition = this.schema();
      if (!schemaDefinition)
        throw new Error(`Unable to find valid model schema for ${this.getModelName()}`);

      U.defineROProperty(this, '__schemaDefinition', schemaDefinition);
      U.defineRWProperty(this, '__modelIsDirty', true);
      U.defineRWProperty(this, '__modelIsPersisted', false);

      var data = _data || {};
      this.defineModelFields(data, schemaDefinition);
    }

    dirty(set) {
      if (!arguments.length)
        return this.__modelIsDirty;

      this.__modelIsDirty = !!set;
    }

    persisted(set) {
      if (!arguments.length)
        return this.__modelIsPersisted;

      this.__modelIsPersisted = !!set;
    }

    getSchemaDefinition() {
      return this.__schemaDefinition;
    }

    convertValueToType(_value, type, isSet) {
      var value = _value;
      if (value == null)
        return null;

      if (typeof value.valueOf === 'function')
        value = value.valueOf();

      if (type === 'json') {
        if (value == null)
          return null;

        return value;
      } else if (type === 'string') {
        if (!value)
          return null;

        return value.toString();
      } else if (type === 'integer') {
        return Math.round(toNumber(value));
      } else if (type === 'double') {
        return toNumber(value);
      } else if (type === 'boolean') {
        return !!value;
      } else if (type === 'date') {
        return moment(value);
      }

      return value;
    }

    defineModelField(fieldName, field, data) {
      const defineDefaultField = () => {
        var fieldType = field.type,
            internalFieldName = `_${fieldName}`,
            defaultValue = data[fieldName],
            isPrimaryKey = !!field.primaryKey;

        if (defaultValue === undefined)
          defaultValue = (typeof field.value === 'function') ? field.value.call(this, data, fieldName, field) : field.value;

        defaultValue = this.convertValueToType(defaultValue, fieldType, false);

        U.defineRWProperty(this, internalFieldName, defaultValue);
        if (isPrimaryKey)
          U.defineRWProperty(this, '__primaryKey', defaultValue);

        Object.defineProperty(this, fieldName, {
          enumerable: true,
          configurable: true,
          get: () => {
            // getter
            return this[internalFieldName];
          },
          set: (val) => {
            if (isPrimaryKey && this.persisted())
              throw new Error('Can not set read-only primary key on model');

            // setter
            var currentVal = this[internalFieldName],
                newValue = this.convertValueToType(val, fieldType, true);

            this[internalFieldName] = newValue;
            if (isPrimaryKey)
              this['__primaryKey'] = newValue;

            if (newValue !== currentVal)
              this.dirty(true);

            return val;
          }
        });
      };

      const defineOwnerRelationField = () => {
        var ownerType = field.type,
            ownerIDField = field.ownerIDField,
            internalFieldName = `_${fieldName}`;

        U.defineRWProperty(this, internalFieldName, null);

        Object.defineProperty(this, fieldName, {
          enumerable: false,
          configurable: true,
          get: () => {
            // First see if we already have a valid loaded owner
            var currentValue = this[internalFieldName];
            if (currentValue)
              return (currentValue instanceof LazyItem) ? currentValue.fetch() : currentValue;

            // Attempt to get an owner id
            var ownerID = this[ownerIDField];
            if (!ownerID)
              return null;

            // Do we have access to a database and a schema?
            var database = this.getApplicationDatabase(),
                schema = this.getMasterSchema();

            if (!database || !schema)
              return null;

            // Do we have the information we need to attempt to load the owner?
            var modelSchema = schema.getModelSchema(ownerType),
                primaryKeyField = (modelSchema) ? modelSchema.getPrimaryKeyField() : null,
                primaryKeyFieldName = (primaryKeyField && primaryKeyField.name) || 'id';

            if (!primaryKeyFieldName)
              return null;

            // Attempt to load the owner
            var ownerPromise = database.query(ownerType)[primaryKeyFieldName].eq(ownerID).limit(1).first;

            // Set loaded owner
            // ownerPromise.then((owner) => {
            //   this[fieldName] = owner;
            // }, () => {
            //   this[fieldName] = null;
            // });

            return ownerPromise;
          },
          set: (value) => {
            this.dirty(true);
            this[internalFieldName] = new LazyItem(value);
            return value;
          }
        });
      };

      const defineHasManyRelationField = () => {
        // const makeOwnerCollection = (collection) => {
        //   if (!(collection instanceof LazyCollection))
        //     return collection;

        //   collection.mutator((item, index, eager) => {
        //     item[childRelationField] = this;
        //     return item;
        //   });

        //   return collection;
        // };

        var fieldType = field.type,
            childType = field.type,
            childRelationField = field.relationField,
            childIDField = `${childRelationField}_id`,
            childOrderField = `${childRelationField}_order`,
            internalFieldName = `_${fieldName}`,
            primaryKeyField = this.schema().getPrimaryKeyField(),
            primaryKeyFieldName = (primaryKeyField && primaryKeyField.name) || 'id',
            defaultValue = data[fieldName];

        if (defaultValue === undefined)
          defaultValue = (typeof field.value === 'function') ? field.value.call(this, data, fieldName, field) : field.value;

        defaultValue = this.convertValueToType(defaultValue, fieldType, false);

        U.defineRWProperty(this, internalFieldName, defaultValue);

        Object.defineProperty(this, fieldName, {
          enumerable: false,
          configurable: true,
          get: () => {
            const buildRelationalQuery = () => {
              var query = database.query(childType),
                  relationalQuery;

              if (field.through) {
                var targetModelSchema = this.getMasterSchema().getModelSchema(childType),
                    targetPrimaryKeyField = targetModelSchema.getPrimaryKeyField(),
                    targetPrimaryKeyFieldName = (targetPrimaryKeyField && targetPrimaryKeyField.name) || 'id',
                    throughRelationField = targetModelSchema.getField(field.relationField);

                relationalQuery = query.join((query) => {
                  return query.model(field.through)[field.throughFieldPK].matches(`${childType}.${targetPrimaryKeyFieldName}`)
                }).and((query) => {
                  return query.model(field.through)[throughRelationField.throughFieldPK].eq(this[primaryKeyFieldName]);
                }).order(field.throughFieldOrder);
              } else {
                relationalQuery = query[childIDField].eq(myID).order(childOrderField);
              }

              return relationalQuery;
            };

            // First see if we already have a valid loaded owner
            var currentValue = this[internalFieldName];
            if (currentValue)
              return currentValue;

            // Do we have access to a database and a schema?
            var database = this.getApplicationDatabase(),
                schema = this.getMasterSchema(),
                myID = this[primaryKeyFieldName];

            if (!database || !schema)
              return new LazyCollection();

            // Do we have the information we need to attempt to load the children?
            var modelSchema = schema.getModelSchema(childType);
            if (!modelSchema)
              return new LazyCollection();

            // Attempt to load the owner
            var collectionPromise = buildRelationalQuery().exec();

            // Set loaded owner
            // collectionPromise.then((collection) => {
            //   this[fieldName] = collection;
            // }, () => {
            //   this[fieldName] = null;
            // });

            return collectionPromise;
          },
          set: (value) => {
            this.dirty(true);
            this[internalFieldName] = LazyCollection.from(value);
            return value;
          }
        });
      };

      const defineRelationField = () => {
        var relation = field.relation;
        if (relation === 'owner')
          defineOwnerRelationField();
        else if (relation === 'has_many')
          defineHasManyRelationField();
      };

      if (field.relation)
        defineRelationField();
      else
        defineDefaultField();
    }

    defineModelFields(data, __schemaDefinition) {
      this.iterateFields((field, fieldName) => this.defineModelField(fieldName, field, data), { virtual: true, relations: true }, __schemaDefinition);
    }

    validate(__schemaDefinition) {
      var errors = [],
          modelName = this.getModelName();

      this.iterateFields((field, fieldName) => {
        var fieldValue = this[fieldName];

        if (field.nullable === false && fieldValue == null)
          errors.push(`${modelName}.${fieldName}: empty value not allowed`);

        if (typeof field.onValidate === 'function') {
          try {
            errors = errors.concat(field.onValidate.call(this, fieldValue, fieldName, field) || []);
          } catch (e) {
            errors.push(e.message);
          }
        }
      }, undefined, __schemaDefinition);

      return (!errors.length) ? undefined : errors;
    }

    iterateFields(cb, _opts, __schemaDefinition) {
      var schemaDefinition = (__schemaDefinition) ? __schemaDefinition : this.getSchemaDefinition(),
          fields = schemaDefinition.getFields(_opts),
          fieldNames = Object.keys(fields),
          rets = [];

      for (var i = 0, il = fieldNames.length; i < il; i++) {
        var fieldName = fieldNames[i],
            field = fields[fieldName];

        rets.push(cb(field, fieldName));
      }

      return rets;
    }

    async onBeforeStore(update) {
      await Promise.all(this.iterateFields(async (field, fieldName) => {
        if (typeof field.onBeforeStore !== 'function')
          return;

        var ret = await field.onBeforeStore.call(this, update, field, this);
        if (ret !== undefined)
          this[fieldName] = ret;
      }, { relations: true }));
    }

    async onAfterStore(update) {
      this.dirty(false);
      this.persisted(true);

      await Promise.all(this.iterateFields(async (field, fieldName) => {
        if (typeof field.onAfterStore !== 'function')
          return;

        var ret = await field.onAfterStore.call(this, update, field, this);
        if (ret !== undefined)
          field[fieldName] = ret;
      }));
    }

    async onDestroy(_opts) {
      var opts = _opts || {},
          masterSchema = this.getMasterSchema(),
          modelID = this.getPrimaryKey(),
          database = this.getApplicationDatabase();

      if (!database)
        return;

      var models = await Promise.all(this.iterateFields(async (field, fieldName) => {
        if (field.relation !== 'has_many')
          return;

        if (field.through) {
          var relationModelSchema = masterSchema.getModelSchema(field.type),
              modelSchemaThroughField = relationModelSchema.getField(field.relationField);

          // Destroy through relations
          return await database.destroy(field.through, opts)[modelSchemaThroughField.throughFieldPK].eq(modelID).exec();
        } else {
          // Destroy has_many relations
          return await database.destroy(field.type, opts)[`${field.relationField}_id`].eq(modelID).exec();
        }
      }, { relations: true }));

      return Array.prototype.concat.apply([], models.filter(Boolean));
    }

    onSerialize() {
      var obj = {};

      this.iterateFields((field, fieldName) => {
        var value = this.getRawValue(fieldName);
        if (value instanceof Promise)
          return;

        if (typeof field.onSerialize === 'function')
          value = field.onSerialize.call(this, value, field, this);

        obj[fieldName] = value;
      });

      return obj;
    }

    toJSON() {
      return this.onSerialize();
    }

    getPrimaryKey() {
      return this.__primaryKey;
    }

    getUniqueIdentifier() {
      return `${this.getModelName()}:${this.getPrimaryKey()}`;
    }

    getRawValue(fieldName) {
      return this[`_${fieldName}`];
    }

    async decomposeModel(alreadyVisited = []) {
      if (alreadyVisited.indexOf(this) >= 0)
        return [];

      var models = [],
          masterSchema = this.getMasterSchema();

      if (this.dirty())
        models.push(this);

      var subModels = await Promise.all(this.iterateFields(async (field, fieldName) => {
        const generateThroughField = (model, index) => {
          var throughModelClass = (masterSchema && masterSchema.getModelClass(field.through)),
              modelSchema = model.schema(),
              modelSchemaThroughField = modelSchema.getField(field.relationField),
              throughModelData = {};

          throughModelData[field.throughFieldPK] = model.getPrimaryKey();
          throughModelData[field.throughFieldOrder] = index;
          throughModelData[modelSchemaThroughField.throughFieldPK] = this.getPrimaryKey();
          throughModelData[modelSchemaThroughField.throughFieldOrder] = index;

          return throughModelClass.create(throughModelData);
        };

        var relation = field.relation,
            childModels = [];

        if (!relation || relation === 'owner')
          return [];

        var value = this.getRawValue(fieldName);
        if (!value)
          return [];

        if (relation === 'has_many') {
          if (typeof value.loadedItems === 'function')
            value = value.loadedItems();

          if (!Array.isArray(value))
            value = [value];

          for (var i = 0, il = value.length; i < il; i++) {
            var model = value[i];
            if (!model)
              continue;

            if (field.through) {
              var throughModel = generateThroughField(model, i),
                  decomposedModels = await throughModel.decomposeModel(alreadyVisited);

              childModels = childModels.concat.apply(childModels, decomposedModels);
            } else {
              if (!model.dirty())
                continue;

              model[field.relationField] = this;
            }

            var decomposedModel = await model.decomposeModel(alreadyVisited);
            childModels = childModels.concat(decomposedModel);
          }
        }

        return childModels;
      }, { relations: true }));

      return models.concat.apply(models, subModels);
    }

    clone() {
      return this.constructor.create(this);
    }
  }

  return {
    ModelBase
  };
});

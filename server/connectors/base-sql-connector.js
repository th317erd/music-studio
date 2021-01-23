/*
  Modified base-sql-connector from Xoumz project (https://github.com/th317erd/xoumz)
  used and modified by permission of the author (Wyatt Greenway) - 09/02/2018
*/

/*
 * BaseSQLConnector
 ** Normalized interface for SQL type databases
 */

const { memoizeModule } = require('../base-utils');

module.exports = memoizeModule(function(_globalOpts) {
  const globalOpts = _globalOpts || {},
        SQLString = require('sqlstring'),
        U = require('evisit-js-utils').utils,
        moment = require('moment'),
        EventEmitter  = require('events'),
        { SQLConnectionWrapper } = require('./sql-connection-wrapper')(globalOpts),
        { Logger } = require('../logger')(globalOpts),
        { flattenQueries } = require('./connector-utils')(globalOpts),
        { QueryBuilder, LazyCollection, LazyItem } = require('../base')(globalOpts);

  const FLOATING_POINT_ERROR_RATIO = 0.000000000000005;

  class BaseSQLConnector extends EventEmitter {
    constructor(_opts) {
      super();

      var opts = Object.assign({}, _opts || {});
      U.defineRWProperty(this, '_options', opts);

      U.defineRWProperty(this, 'readable', undefined, () => this.options.read, (val) => {
        this.options.read = val;
        return val;
      });

      U.defineRWProperty(this, 'writable', undefined, () => this.options.write, (val) => {
        this.options.write = val;
        return val;
      });

      U.defineRWProperty(this, 'primary', undefined, () => this.options.primary, (val) => {
        this.options.primary = val;
        return val;
      });

      U.defineRWProperty(this, '_transactionLock', null);
      U.defineRWProperty(this, '_processQueue', []);
    }

    addToProcessQueue(callback, args) {
      var resolve, reject,
          promise = new Promise((_resolve, _reject) => {
            resolve = _resolve;
            reject = _reject;
          });

      var processQueue = this._processQueue;
      processQueue.push({
        callback,
        args,
        resolve,
        reject
      });

      return promise;
    }

    consumeProcessQueue() {
      var processQueue = this._processQueue;
      if (!processQueue.length)
        return;

      var nextProcess = processQueue.shift();
      if (!nextProcess)
        return;

      try {
        console.log('!!!!!!! Processing queue: ', processQueue.length);
        var ret = nextProcess.callback(...nextProcess.args);
        if (ret instanceof Promise)
          ret.then(nextProcess.resolve, nextProcess.reject);
        else
          nextProcess.resolve(ret);
      } catch (e) {
        nextProcess.reject(e);
      }
    }

    escape(...args) {
      return args.map((arg) => SQLString.escape('' + arg)).join('');
    }

    identifier(value) {
      return value.replace(/[^.]+/g, (m) => {
        return `"${this.escape(m).replace(/^'/, '').replace(/'$/, '')}"`;
      });
    }

    getDefaultDBStorageEngine() {
      throw new Error('SQL connector doesn\'t implement "getDefaultDBStorageEngine" method');
    }

    getDefaultStringMaxLength() {
      return 255;
    }

    getDefaultCharset() {
      return 'utf8';
    }

    getDefaultCollate() {
      throw new Error('SQL connector doesn\'t implement "getDefaultCollate" method');
    }

    async getDriverConnection() {
      throw new Error('SQL connector doesn\'t implement "getDriverConnection" method');
    }

    async getConnection(cb, _opts) {
      if (typeof cb !== 'function')
        throw new Error('getConnection method called without a callback');

      var opts = Object.assign({ connector: this }, _opts || {}),
          onCreateConnectionWrapper = opts.onCreateConnectionWrapper;

      if (typeof onCreateConnectionWrapper !== 'function')
        onCreateConnectionWrapper = (opts) => new SQLConnectionWrapper(opts);

      try {
        opts.driverConnection = await this.getDriverConnection(opts);
        var connectionWrapper = await onCreateConnectionWrapper.call(this, opts);
        return await cb.call(connectionWrapper, connectionWrapper, this, opts);
      } catch (e) {
        throw e;
      } finally {
        try {
          if (connectionWrapper)
            await connectionWrapper.release();
        } catch (e) {}
      }
    }

    transaction(...args) {
      // If there is an active lock, add to the process queue and continue
      if (this._transactionLock)
        return this.addToProcessQueue(this.transaction.bind(this), args);

      var promise = this.getConnection(function() {
        return this.transaction(...args);
      });

      // Lock future transactions (so we don't accidentally have multiple transactions happening at once)
      this._transactionLock = promise;

      // nextTick here is to allow other callbacks to be bound first
      // so we start processing the next process in the queue only after
      // all running processes have fully finalized
      process.nextTick(() => {
        var queueProcessor = () => {
          if (this._transactionLock === promise)
            this._transactionLock = null;

          this.consumeProcessQueue();
        };

        promise.then(queueProcessor, queueProcessor);
      });

      return promise;
    }

    async exec(connection, _statements, _opts) {
      var opts = _opts || {};

      if (!connection)
        throw new Error(`Attempting to execute a statement against an void connection for ${opts}`);

      var statements = flattenQueries(_statements, opts),
          results = [];

      for (var i = 0, il = statements.length; i < il; i++) {
        var statement = statements[i];

        try {
          var result = await this.execRaw(connection, statement, opts);
          if (statement.discardResponse !== true)
            results.push(result);
        } catch (e) {
          if (statement.isRequired !== false)
            throw e;

          if (statement.discardResponse !== true)
            results.push(e);
        }
      }

      return (Array.isArray(_statements) || results.length > 1) ? results : results[0];
    }

    execRaw(statement, _opts) {
      throw new Error('SQL connector doesn\'t implement "execRaw" method');
    }

    fieldDefinitionToSQLType(field) {
      if (!field || !field.type)
        return '';

      var type = ('' + field.type).toLowerCase();
      if (type === 'integer') {
        return 'INT';
      } else if (type === 'double') {
        return 'DOUBLE';
      } else if (type === 'boolean') {
        return 'TINYINT(1)';
      } else if (type === 'string' || type === 'json') {
        var size = field.max;
        if (!size)
          size = this.getDefaultStringMaxLength();

        return `VARCHAR(${size})`;
      } else if (type === 'date') {
        return 'DATETIME';
      }
    }

    sqlTypeToFieldDefinitionType(sqlType) {
      if (!sqlType)
        return '';

      var type = ('' + sqlType).toLowerCase();
      if (type === 'int')
        return 'integer';
      else if (type === 'double' || type === 'float' || type === 'decimal')
        return 'double';
      else if (type === 'tinyint')
        return 'boolean';
      else if (type === 'varchar' || type === 'char')
        return 'string';
      else if (type === 'date' || type === 'timestamp' || type === 'time' || type === 'datetime')
        return 'date';
    }

    fieldDefinitionToSQLTypeFlags(field) {
      if (!field || !field.type)
        return '';

      var type = field.type,
          parts = [];

      if (type === 'string' || type === 'json') {
        var charsetFlags = this.getCharsetFlags();
        if (!U.noe(charsetFlags))
          parts.push(charsetFlags);
      }

      if (!field.nullable)
        parts.push('NOT NULL');

      if (field.primaryKey)
        parts.push('PRIMARY KEY');

      if (field.autoIncrement)
        parts.push('AUTOINCREMENT');

      return parts.join(' ');
    }

    generateFieldDefinitionQuery(field, _opts) {
      var opts = _opts || {},
          rawQuery = [],
          fieldName = field.name;

      rawQuery.push(`${this.identifier(fieldName)} ${this.fieldDefinitionToSQLType(field, opts)}`);

      var flags = this.fieldDefinitionToSQLTypeFlags(field, opts);
      if (!U.noe(flags)) {
        rawQuery.push(' ');
        rawQuery.push(flags);
      }

      return rawQuery.join('');
    }

    mapDatabaseSchemaToField(row) {
      var rawField = {},
          schemaFields = this.getSQLSchemaFields(),
          schemaFieldKeys = this.getSQLSchemaFieldKeys();

      for (var i = 0, il = schemaFieldKeys.length; i < il; i++) {
        var key = schemaFieldKeys[i],
            rowKey = schemaFields[key],
            val = (typeof rowKey === 'function') ? rowKey.call(this, row) : row[rowKey];

        if (key === 'field.nullable')
          val = !(('' + val).match(/^(0|n|f)/i));
        else if (key === 'field.primaryKey')
          val = !!('' + val).match(/(true|pri)/i);
        else if (key === 'field.type')
          val = this.sqlTypeToFieldDefinitionType(val);

        U.set(rawField, key, val);
      }

      return rawField.field;
    }

    getCountFromRows(rows) {
      var row = (rows || [])[0],
          count = (row) ? row['count(*)'] : 0;
      return (count) ? count : 0;
    }

    getFieldNameDiff(schemaDefinition, rawTableSchema) {
      // TODO: Make smarter
      var fields = schemaDefinition.getFields(),
          allKeys = Object.keys(Object.keys(fields).concat(Object.keys(rawTableSchema)).reduce((obj, key) => ((obj[key] = true) && obj), {}));

      return allKeys.map((fieldName) => {
        var newField = fields[fieldName],
            oldField = rawTableSchema[fieldName];

        return { oldField: (oldField) ? fieldName : undefined, newField: (newField) ? fieldName : undefined };
      });
    }

    getModelFromTableName(schema, tableName) {
      return schema.getModelSchema(tableName);
    }

    verifySchemaUpdate(schema, rawTableSchema, _opts) {
      var opts = _opts || {},
          models = schema.getModelSchemas(),
          modelNames = Object.keys(models),
          schemaKeysToCheck = ['max', 'model', 'name', 'nullable', 'primaryKey', 'type'];

      for (var i = 0, il = modelNames.length; i < il; i++) {
        var modelName = modelNames[i],
            modelSchema = models[modelName];

        // The database doesn't contain this model schema, so just skip checks
        if (!rawTableSchema.hasOwnProperty(modelName))
          continue;

        var rawSchema = rawTableSchema[modelName],
            fields = modelSchema.getFields(),
            fieldNames = Object.keys(fields);

        for (var j = 0, jl = fieldNames.length; j < jl; j++) {
          var fieldName = fieldNames[j],
              field = fields[fieldName],
              rawField = rawSchema[fieldName];

          // Field is being added?... that is okay
          if (!rawField)
            continue;

          schemaKeysToCheck.forEach((key) => {
            var rawValue = rawField[key],
                fieldDefValue = field[key];

            if (rawValue !== fieldDefValue) {
              if (key === 'type' && rawValue === 'string' && fieldDefValue === 'json')
                return;

              throw new Error(`Model ${modelName} field ${fieldName} differs from what is in the database. Aborting. Do you need to run a migration?`);
            }
          });
        }
      }
    }

    async buildTablesFromSchema(schema, _opts) {
      var opts = _opts || {},
          rawTableSchema = await this.getRawDatabaseSchema(Object.assign({}, opts, { force: true })),
          models = schema.getModelSchemas(),
          tableNames = Object.keys(models),
          allQueries = [];

      // This will throw an exception if there is a problem
      this.verifySchemaUpdate(schema, rawTableSchema, opts);

      for (var i = 0, il = tableNames.length; i < il; i++) {
        var tableName = tableNames[i],
            schemaDefinition = models[tableName],
            hasTable = rawTableSchema.hasOwnProperty(tableName);

        var queries = (hasTable)
              ? await this.generateTableUpdateQueries(schemaDefinition, opts)
              : await this.generateTableCreateQueries(schemaDefinition, opts);

        if (!queries || !queries.length)
          continue;

        allQueries.push(queries);
      }

      if (!allQueries.length)
        return;

      await this.transaction((connection) => {
        connection.exec(allQueries, opts);
      });
    }

    queryToSQLQueryString(schema, queryBuilder, _opts) {
      var connection = (_opts || {}).connection || this;
      return queryBuilder.toSQL(schema, queryBuilder, Object.assign({
        identifier: connection.identifier.bind(connection),
        escape: connection.escape.bind(connection)
      }, _opts || {}));
    }

    buildQueryParts(schema, query) {
      var modelNames = query.getAllTypes(),
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

    async storeModel(_model, _opts) {
      var opts = _opts || {},
          model = _model,
          ret,
          sqlConnection = opts.connection || this,
          sqlTransaction = opts.transaction || sqlConnection,
          schemaDefinition = model.schema(),
          tableName = schemaDefinition.name,
          fields = schemaDefinition.getFields(),
          fieldNames = Object.keys(fields),
          sqlFieldNames = [],
          sqlValues = [],
          updateOperation = false,
          primaryKeyField = schemaDefinition.getPrimaryKeyField(),
          primaryKeyFieldName = (primaryKeyField && primaryKeyField.name) || 'id',
          primaryKeyValue = model[primaryKeyFieldName],
          primaryKeyValueEscaped = sqlConnection.escape(model[primaryKeyFieldName]);

      // Does this row already exist in the database?
      try {
        var querySQL = `SELECT ${primaryKeyFieldName} FROM ${tableName} WHERE ${primaryKeyFieldName}=${primaryKeyValueEscaped} LIMIT 1`,
            result = await sqlConnection.exec(querySQL, undefined, opts),
            rows = this.getRowsFromQueryResult(result);

        updateOperation = !U.noe(rows);
      } catch (e) {}

      // Call model beforeStore hook
      ret = await model.onBeforeStore(updateOperation);
      if (ret) model = ret;

      // Validate model
      var validationErrors = model.validate();
      if (validationErrors) {
        var error = new Error(`Model validation failed during save:\n  * ${validationErrors.join('\n  * ')}`);
        error.errors = validationErrors;
        throw error;
      }

      // Get all values from model using model schema
      for (var i = 0, il = fieldNames.length; i < il; i++) {
        var fieldName = fieldNames[i],
            field = fields[fieldName],
            fieldValue = model[fieldName];

        // Only allow updates if directly specified
        if (updateOperation && field.alwaysAllowUpdate !== true && opts.allowUpdate !== true)
          throw new Error(`Attempting to write ${model.getModelName()} model with ${primaryKeyFieldName} of ${primaryKeyValueEscaped} but ${primaryKeyFieldName} already exists in database`);

        // Convert dates and booleans
        if (field.type === 'date') {
          fieldValue = moment(fieldValue).utc().valueOf();
        } else if (field.type === 'boolean') {
          fieldValue = (fieldValue) ? 1 : 0;
        } else if (field.type === 'json') {
          if (typeof fieldValue !== 'string' || (fieldValue.charAt(0) !== '[' && fieldValue.charAt(0) !== '{'))
            fieldValue = JSON.stringify(fieldValue);
        }

        // Convert other values
        if (fieldValue)
          fieldValue = `${sqlConnection.escape(fieldValue)}`;
        else if (fieldValue === undefined || fieldValue === null)
          fieldValue = 'NULL';

        sqlFieldNames.push(this.identifier(fieldName));
        sqlValues.push(fieldValue);
      }

      // Build SQL query
      if (updateOperation)
        var rawQueryStr = `UPDATE ${this.identifier(tableName)} SET ${sqlValues.map((v, i) => `${sqlFieldNames[i]}=${v}`).join(',')} WHERE ${this.identifier(primaryKeyFieldName)}=${primaryKeyValueEscaped}`;
      else
        var rawQueryStr = `INSERT INTO ${this.identifier(tableName)} (${sqlFieldNames.join(',')}) VALUES (${sqlValues.join(',')})`;

      try {
        // Execute query
        await sqlTransaction.exec(rawQueryStr, undefined, _opts);

        // Call model beforeStore hook
        ret = await model.onAfterStore(updateOperation);
        if (ret) model = ret;

        this.emit((updateOperation) ? 'model:updated' : 'model:created', model);
      } catch (e) {
        Logger.error(e);
        throw e;
      }

      return { success: true, id: primaryKeyValue, type: (updateOperation) ? 'update' : 'create' };
    }

    async decomposeAllModels(_models) {
      if (!_models)
        return [];

      var models = (Array.isArray(_models)) ? _models : [_models];
      var subModels = await Promise.all(models.filter(Boolean).map(async (model) => {
        return await model.decomposeModel();
      }));

      return Array.prototype.concat.apply([], subModels);
    }

    async store(_models, _opts) {
      var opts = _opts || {},
          models = (Array.isArray(_models)) ? _models : [_models],
          results = [];

      for (var i = 0, il = models.length; i < il; i++) {
        var model = models[i],
            dirtyModels = await this.decomposeAllModels(model);

        await this.transaction(async (transaction, connection) => {
          var thisOpts = Object.assign({}, opts, { transaction, connection });

          for (var i = 0, il = dirtyModels.length; i < il; i++) {
            var model = dirtyModels[i];
            if (!model)
              continue;

            results.push(await this.storeModel(model, thisOpts));
          }
        });
      }

      return results;
    }

    parseModelFieldsFromRow(schema, row, models) {
      function getSchemaInfoFromKey(key) {
        var type, field = key;
        ('' + key).replace(/^([^.]+)\.(.+)$/, function(m, _type, _field) {
          type = _type;
          field = _field;
        });

        return { type, field };
      }

      if (!row)
        return;

      var keys = Object.keys(row);
      for (var i = 0, il = keys.length; i < il; i++) {
        var key = keys[i],
            { type, field } = getSchemaInfoFromKey(key),
            modelSchema = schema.getModelSchema(type);

        if (!modelSchema)
          throw new TypeError(`Unable to get schema for model type "${type}"`);

        var schemaField = modelSchema.getField(field);
        if (!schemaField)
          throw new TypeError(`Unable to get schema field "${field}" for model type "${type}"`);

        var modelTypeGroup = models[type],
            primaryKeyField = modelSchema.getPrimaryKeyField(),
            primaryKeyFieldName = (primaryKeyField && primaryKeyField.name) || 'id',
            primaryKeyFieldValue = row[`${type}.${primaryKeyFieldName}`];

        // something went wrong or this isn't the primary model for this row
        if (!primaryKeyFieldValue)
          continue;

        if (!modelTypeGroup)
          modelTypeGroup = models[type] = {};

        var thisModel = modelTypeGroup[primaryKeyFieldValue];
        if (!thisModel)
          thisModel = modelTypeGroup[primaryKeyFieldValue] = {};

        var columnValue = row[key];
        if (schemaField.type === 'json')
          columnValue = JSON.parse(columnValue);

        thisModel[field] = columnValue;
      }
    }

    stitchModelsFromRawData(schema, models) {
      var finalModels = {},
          typeKeys = Object.keys(models);

      for (var i = 0, il = typeKeys.length; i < il; i++) {
        var type = typeKeys[i],
            modelTypeGroup = models[type],
            modelClass = schema.getModelClass(type);

        if (!modelTypeGroup || !modelClass)
          throw new TypeError(`Not able to find model class for schema type "${type}"`);

        var primaryKeyValues = Object.keys(modelTypeGroup);
        for (var j = 0, jl = primaryKeyValues.length; j < jl; j++) {
          var primaryKeyValue = primaryKeyValues[j],
              modelData = modelTypeGroup[primaryKeyValue],
              model = modelClass.create(modelData);

          model.dirty(false);
          model.persisted(true);
          finalModels[primaryKeyValue] = model;
        }
      }

      return Object.keys(finalModels).map((primaryKey) => finalModels[primaryKey]);
    }

    createModelsFromRawRowData(schema, rows) {
      if (!rows || !rows.length)
        return [];

      var models = {};
      for (var i = 0, il = rows.length; i < il; i++) {
        var row = rows[i];
        this.parseModelFieldsFromRow(schema, row, models);
      }

      return this.stitchModelsFromRawData(schema, models);
    }

    async getRowsRaw(sqlStatement) {
      return await this.getConnection(async (connection, connector) => {
        var result = await connection.exec(sqlStatement);
        return (connector.getRowsFromQueryResult(result) || []);
      });
    }

    async loadModelsFromSQLStatement(schema, sqlStatement) {
      var rows = await this.getRowsRaw(sqlStatement);

      return this.createModelsFromRawRowData(schema, rows);
    }

    async querySegmentLoader(schema, pageSize, { statementBuilder, offset }, index, eager, items) {
      // If this item is loaded and a single item is being requested, return it
      // If this item is loaded and multiple items are being loaded, still return
      // it, because if this item is loaded the entire group should already be loaded
      var lazyItem = items[index];
      if (lazyItem.loaded())
        return lazyItem.value();

      var sqlStatement;
      if (!eager) {
        // Load a single item
        sqlStatement = statementBuilder({ offset: 0, limit: 1 });
      } else {
        // Load an entire page of items
        var pageOffset = 0;

        // Calculate page and offset from specified index
        if (pageSize) {
          // Here we take into account a very minor floating point error ratio
          // that can happen every once in a while (sometimes the math below)
          // will result into a floating point deviation of up to 0.000000000000004
          // which breaks the "Math.floor" and results in the wrong page.
          // We add this error ratio and do a second "floor" to ensure the number hasn't
          // changed. If it has, we select the larger (correct one) of the two
          var val = ((index / items.length) * (items.length / pageSize)),
              a = Math.floor(val),
              b = Math.floor(val + FLOATING_POINT_ERROR_RATIO),
              page = (a !== b) ? b : a;

          pageOffset = pageSize * page;
        }

        sqlStatement = statementBuilder({ offset: offset + pageOffset });
      }

      // Load models
      var models = await this.loadModelsFromSQLStatement(schema, sqlStatement);

      // Resolve LazyItems with loaded models
      models.forEach((model, thisIndex) => {
        items[index + thisIndex].resolveWith(model);
      });

      // We always resolve with the first model loaded
      return models[0];
    }

    async getQueryCount(sqlStatement) {
      var rows = await this.getRowsRaw(sqlStatement);
      return this.getCountFromRows(rows || []);
    }

    async getIDsFromStatementBuilder({ statementBuilder }) {
      var rows = await this.getRowsRaw(statementBuilder({ limit: 0, offset: 0, onlyPrimaryKey: true }));
      return (rows || []).map((row) => row[Object.keys(row)[0]]);
    }

    // WIP: Load ids (getIDsFromStatementBuilder) first for caching
    async createQueryLazyCollection(schema, queryInfo) {
      var { statementBuilder, pageSize, limit, offset } = queryInfo;

      var totalRowCount = await this.getQueryCount(statementBuilder({ onlyCount: true, offset: 0 })) - offset;
      if (totalRowCount < 0)
        totalRowCount = 0;

      if (limit != null && totalRowCount > limit)
        totalRowCount = limit;

      // Create enough lazy items to be placeholders
      var lazyItems = new Array(totalRowCount);
      for (var i = 0, il = totalRowCount; i < il; i++)
        lazyItems[i] = new LazyItem(this.querySegmentLoader.bind(this, schema, 1, queryInfo));

      // Create our lazy collection to load items only when needed
      var collection = LazyCollection.from(lazyItems);
      collection.fetcher(this.querySegmentLoader.bind(this, schema, pageSize, queryInfo));

      return collection;
    }

    buildQueryPollingInterface(schema, _query, _opts) {
      if (!schema)
        throw new TypeError('"schema" must be provided in order to run a database query');

      if (!_query)
        throw new TypeError('"query" must be provided in order to run a database query');

      var opts = _opts || {},
          queryOpts = Object.assign({}, opts),
          query = _query.finalize(),
          pageSize = opts.pageSize || query.pageSize(),
          limit = opts.limit || query.limit(),
          offset = opts.offset || query.offset(),
          order = opts.order || query.order(),
          useDefaultLimit = opts.useDefaultLimit;

      // If limit is zero or less than zero than there will be no limit
      if (typeof limit === 'number' && limit <= 0)
        limit = 0;

      if (!offset || offset < 0)
        offset = 0;

      return {
        statementBuilder: (_args) => {
          var args = _args || {},
              limitOverride = args.limit,
              offset = args.offset,
              onlyCount = args.onlyCount,
              onlyPrimaryKey = args.onlyPrimaryKey,
              queryFields = (onlyPrimaryKey) ? [ '__primaryKey' ] : null,
              thisLimit = limit;

          if (limitOverride)
            thisLimit = limitOverride;
          else if (limit == null && pageSize && useDefaultLimit !== false)
            thisLimit = pageSize;
          else if (limit)
            thisLimit = limit;

          queryOpts.limit = thisLimit;
          queryOpts.offset = offset;
          queryOpts.onlyCount = onlyCount;
          queryOpts.fields = queryFields;

          return query.toSQL(schema, queryOpts);
        },
        queryOpts,
        query,
        offset,
        pageSize,
        limit,
        order
      };
    }

    async query(schema, query, _opts) {
      var opts = _opts || {},
          queryInfo = this.buildQueryPollingInterface(schema, query, opts);

      if (opts.onlyCount)
        return await this.getQueryCount(queryInfo.statementBuilder({ onlyCount: true, offset: 0 }));

      return await this.createQueryLazyCollection(schema, queryInfo);
    }

    modelIDToModel(schema, modelID) {
      var schemaCode = schema.getRootSchemaName(modelID),
          modelSchema = schema.getModelSchemaFromSchemaCode(schemaCode),
          modelName = (modelSchema && modelSchema.getModelName()),
          modelClass = schema.getModelClass(modelName);

      if (!modelClass)
        throw new Error(`No model "${modelName}" found`);

      var primaryKeyField = (modelSchema && modelSchema.getPrimaryKeyField()),
          primaryKeyFieldName = (primaryKeyField && primaryKeyField.name),
          modelData = {};

      if (!primaryKeyFieldName)
        throw new Error(`Model "${modelName}" has no defined primary key`);

      modelData[primaryKeyFieldName] = modelID;
      return modelClass.create(modelData);
    }

    async destroy(schema, _models, _opts) {
      const addToDestroyIDs = (modelName, fieldName, id) => {
        // Get/create field namespace
        var destroyIDs = modelDestroyQueryIDs[modelName];
        if (!destroyIDs)
          destroyIDs = modelDestroyQueryIDs[modelName] = { pkField: fieldName, ids: [] };

        destroyIDs.ids.push(id);
      };

      var opts = _opts || {},
          alreadyDestroyedModels = opts.alreadyDestroyedModels || {},
          models = (Array.isArray(_models)) ? _models : [_models],
          modelDestroyQueryIDs = {};

      // Collect ids from all models being destroyed
      for (var i = 0, il = models.length; i < il; i++) {
        var model = models[i];
        if (!model)
          continue;

        var modelName = model.getModelName(),
            modelSchema = model.schema(),
            primaryKeyField = (modelSchema && modelSchema.getPrimaryKeyField()),
            primaryKeyFieldName = (primaryKeyField && primaryKeyField.name);

        if (!primaryKeyFieldName)
          continue;

        // Add the id to the list of rows to destroy
        var modelPK = model[primaryKeyFieldName];
        addToDestroyIDs(modelName, primaryKeyFieldName, modelPK);
      }

      // Destroy all models and collect ids
      var allModelIDs = [];
      await this.transaction((connection) => {
        Object.keys(modelDestroyQueryIDs).map((modelName) => {
          var { pkField, ids } = modelDestroyQueryIDs[modelName],
              query = `DELETE FROM ${this.identifier(modelName)} WHERE ${this.identifier(pkField)} IN (${ids.map((id) => this.escape(id)).join(',')})`;

          allModelIDs = allModelIDs.concat(ids);
          connection.exec(query, opts);
        });
      });

      // Create models from ids, and add destroyed models to detroyed model map (to prevent cyclic operations)
      var destroyedModels = allModelIDs.map((modelID) => this.modelIDToModel(schema, modelID));
      Object.assign(alreadyDestroyedModels, allModelIDs.reduce((obj, modelID) => {
        obj[modelID] = true;
        return obj;
      }, {}));

      // Destroy relations
      var modelIDMap = {};
      destroyedModels = destroyedModels.concat.apply(destroyedModels, await Promise.all(destroyedModels.map(async (model) => {
        return await model.onDestroy(opts);
      }))).filter((model) => {
        var modelID = model.getPrimaryKey();
        if (modelIDMap[modelID])
          return false;

        modelIDMap[modelID] = true;
        return true;
      });

      // Emit destroyed events
      destroyedModels.forEach((model) => {
        this.emit('model:destroyed', model);
      });

      return destroyedModels;
    }

    async destroyByQuery(schema, query, _opts) {
      var opts = _opts || {},
          alreadyDestroyedModels = opts.alreadyDestroyedModels || {},
          queryInfo = this.buildQueryPollingInterface(schema, query, opts),
          { statementBuilder } = queryInfo;

      if (opts.onlyCount)
        return await this.getQueryCount(statementBuilder({ onlyCount: true, offset: 0 }));

      var deleteIDs = ((await this.getIDsFromStatementBuilder(queryInfo)) || []).filter((modelID) => {
        return !alreadyDestroyedModels[modelID];
      });

      if (!deleteIDs)
        return [];

      var models = deleteIDs.map((modelID) => this.modelIDToModel(schema, modelID));
      return await this.destroy(schema, models, opts);
    }

    createNewQuery(modelName) {
      var query = new QueryBuilder();
      if (modelName)
        return query.model(modelName);

      return query;
    }

    async start() {

    }

    async stop() {

    }
  }

  return {
    BaseSQLConnector
  };
});

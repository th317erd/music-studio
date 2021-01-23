/*
  Modified sqlite-connector from Xoumz project (https://github.com/th317erd/xoumz)
  used and modified by permission of the author (Wyatt Greenway) - 09/02/2018
*/

/*
 * SQLiteConnector
 ** Normalized interface for SQLite database
 */

const { memoizeModule } = require('../base-utils');

module.exports = memoizeModule(function(_globalOpts) {
  const globalOpts = _globalOpts || {},
        U = require('evisit-js-utils').utils,
        Database = require('better-sqlite3'),
        { BaseSQLConnector } = require('./base-sql-connector')(globalOpts),
        { Logger } = require('../logger')(globalOpts),
        { parseConnectionString } = require('./connector-utils')(globalOpts);

  // this is for direct database schema to field mappings
  const SCHEMA_COLUMNS = {
          'table.name': 'table_name',
          'field.model': 'table_name',
          'field.name': 'name',
          'field.value': 'dflt_value',
          'field.nullable': (row) => !row.notnull,
          'field.primaryKey': (row) => ((row.pk) ? 'pri' : ''),
          'field.type': (row) => (row.type.replace(/^(\w+).*$/g, '$1')),
          'field.max': (row) => {
            var size;

            row.type.replace(/^\w+\s*\(\s*([\d.-]+)\s*\)/g, function(m, p) {
              size = parseFloat(p);
            });

            return size;
          }
        },
        SCHEMA_COLUMNS_KEYS = Object.keys(SCHEMA_COLUMNS);

  // SQLite DB wrapper
  class SQLiteConnector extends BaseSQLConnector {
    constructor(_opts) {
      var opts = Object.assign({
        timeout: 15000,
        readonly: false,
        fileMustExist: false,
        read: true,
        write: true
      }, _opts || {});

      if (opts.connectionString) {
        var connection = parseConnectionString(opts.connectionString);
        if (connection.protocol !== 'jdbc:' && connection.subProtocol !== 'sqlite:')
          throw new TypeError('Invalid "connectionString" given to SQLiteConnector constructor. "sqlite:" protocol not specified');

        opts.databasePath = connection.resource;
      }

      if (!opts.databasePath) {
        opts.databasePath = ':memory:';
        opts.memory = true;
      }

      super(opts);

      U.defineRWProperty(this, 'database', new Database(opts.databasePath, opts));
      U.defineRWProperty(this, '_rawSchemaCache', null);
    }

    getDefaultDBStorageEngine() {
      return null;
    }

    getDefaultCollate() {
      return null;
    }

    getCharsetFlags() {
      return null;
    }

    getDefaultStringMaxLength() {
      return 255;
    }

    async getDriverConnection() {
      return this;
    }

    execRaw(connection, statement, _opts) {
      function queryReturnsData(queryStr) {
        if (queryStr.match(/^\s*(?:select|PRAGMA\s+(table_info|database_info))\b/i))
          return true;

        return false;
      }

      return new Promise((resolve, reject) => {
        try {
          var queryStr = statement.query,
              dbQuery = this.database.prepare(queryStr),
              ret = (queryReturnsData(queryStr)) ? dbQuery.all.apply(dbQuery, statement.values || []) : dbQuery.run.apply(dbQuery, statement.values || []);

          resolve(ret);
        } catch (e) {
          var error = new Error(`Error while executing SQL: [${queryStr}]: ${e}`);
          Logger.debug(error);
          reject(error);
        }
      });
    }

    getDefaultDBStorageEngine() {
      return null;
    }

    getDefaultCollate() {
      return null;
    }

    getCharsetFlags() {
      return null;
    }

    getSQLSchemaFields() {
      return SCHEMA_COLUMNS;
    }

    getSQLSchemaFieldKeys() {
      return SCHEMA_COLUMNS_KEYS;
    }

    async generateTableCreateQueries(schemaDefinition, _opts) {
      var opts = _opts || {},
          rawQuery = [],
          tableName = schemaDefinition.getTableName(),
          fields = schemaDefinition.getFields(),
          fieldFilter = opts.fieldFilter,
          modifyQuery = opts.modifyQuery;

      if (typeof fieldFilter !== 'function')
        fieldFilter = () => true;

      if (typeof modifyQuery !== 'function')
        modifyQuery = (rawQuery) => rawQuery;

      rawQuery.push(`CREATE TABLE ${this.identifier(tableName)} (`);

      var fieldNames = Object.keys(fields);
      for (var i = 0, il = fieldNames.length; i < il; i++) {
        var fieldName = fieldNames[i],
            field = fields[fieldName];

        if (!fieldFilter.call(this, field, rawQuery, tableName, fields, opts))
          continue;

        if (i > 0)
          rawQuery.push(', ');

        rawQuery.push(this.generateFieldDefinitionQuery(field));
      }

      rawQuery.push(')');

      // Possibly modify the query
      rawQuery = modifyQuery.call(this, rawQuery, tableName, fields, opts);

      return [{ query: rawQuery.join('') }];
    }

    async generateTableUpdateQueries(schemaDefinition, _opts) {
      var opts = _opts || {},
          queries = [],
          tableName = schemaDefinition.getTableName(),
          fields = schemaDefinition.getFields(),
          fieldNames = Object.keys(fields),
          rawTableSchema = fields,
          create,
          tempTableName;

      if (!opts.hasOwnProperty('create')) {
        var rawDatabaseSchema = await this.getRawDatabaseSchema(opts);
        if (!rawDatabaseSchema)
          throw new Error(`Unable to get raw table schema from SQLite connector`);

        create = !rawDatabaseSchema.hasOwnProperty(tableName);
        if (!create)
          rawTableSchema = rawDatabaseSchema[tableName];
      } else {
        create = opts.create;
      }

      if (opts.force)
        queries.push({ query: `DROP TABLE ${tableName}`, required: false });

      if (!create) {
        if (!fieldNames.length)
          throw new Error('Trying to create a table but no fields are found');

        tempTableName = this.identifier(`_${tableName}`);
        queries.push({ query: 'PRAGMA foreign_keys=off', discardResponse: true });
        queries.push({ query: 'BEGIN TRANSACTION', discardResponse: true });
        queries.push({ query: `ALTER TABLE ${this.identifier(tableName)} RENAME TO ${tempTableName}`, discardResponse: true });
      }

      var createQueries = await this.generateTableCreateQueries(schemaDefinition, opts);
      queries = queries.concat(createQueries);

      if (!create) {
        var fieldNameDiff = this.getFieldNameDiff(schemaDefinition, rawTableSchema),
            fieldNames = fieldNameDiff.map((field) => field.oldField).filter((name) => name).map((field) => this.identifier(field));

        queries.push({ query: `INSERT INTO ${this.identifier(tableName)} (${fieldNames.join(',')}) SELECT ${fieldNames.join(',')} FROM ${tempTableName}`, discardResponse: true });
        queries.push({ query: `DROP TABLE ${tempTableName}`, discardResponse: true });
        queries.push({ query: 'COMMIT', discardResponse: true });
        queries.push({ query: 'PRAGMA foreign_keys=on', discardResponse: true });
      }

      return queries;
    }

    async getRawDatabaseSchema(_opts) {
      try {
        var opts = _opts || {};
        if (this._rawSchemaCache && opts.force !== true)
          return this._rawSchemaCache;

        var rawSchema = {},
            { tableInfo, tableNames } = await this.getConnection(async function(connection, connector) {
                  // Get a list of all tables
              var result = await this.exec("SELECT name FROM sqlite_master WHERE type='table'", opts),
                  // Get fields for each table
                  tableNames = (connector.getRowsFromQueryResult(result) || []).map(({ name }) => name),
                  queries = tableNames.map((name) => {
                    return { query: `PRAGMA table_info(${name})` };
                  }),
                  tableInfo = (queries && queries.length) ? await this.exec(queries, opts) : [];

              if (!tableInfo)
                tableInfo = [];

              return { tableInfo, tableNames };
            });

        // Iterate tables
        for (var i = 0, il = tableInfo.length; i < il; i++) {
          var infoResult = tableInfo[i],
              tableName = tableNames[i],
              // Get fields for this table
              rows = this.getRowsFromQueryResult(infoResult);

          for (var j = 0, jl = rows.length; j < jl; j++) {
            var sqlLiteField = rows[j],
                // Inject the "table_name" in this field, and pass it through our normal "getSchemaTypeFromRow" getter
                field = this.mapDatabaseSchemaToField(Object.assign(sqlLiteField || {}, { table_name: tableName })),
                table = rawSchema[tableName];

            if (!table)
              table = rawSchema[tableName] = {};

            table[field.name] = field;
          }
        }

        this._rawSchemaCache = rawSchema;
        return rawSchema;
      } catch (e) {
        Logger.error(e);
      }
    }

    getRowsFromQueryResult(result) {
      return result;
    }

    async start() {
      await super.start();
    }

    async stop() {
      await super.stop();
      this.database.close();
      this.database = null;
    }
  }

  return {
    SQLiteConnector
  };
});


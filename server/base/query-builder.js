/*
  Modified sql-transaction from Xoumz project (https://github.com/th317erd/xoumz)
  used and modified by permission of the author (Wyatt Greenway) - 09/02/2018
*/

/*
 * QueryBuilder
 ** Build database queries in a generic uniform way
 */

const { memoizeModule } = require('../base-utils');

module.exports = memoizeModule(function(_globalOpts) {
  const globalOpts = _globalOpts || {},
        U = require('evisit-js-utils').utils,
        D = require('evisit-js-utils').data,
        { Chainable } = require('./chainable')(globalOpts),
        { LazyCollection } = require('./lazy-collection')(globalOpts),
        SQLString = require('sqlstring'),
        { Logger } = require('../logger')(globalOpts);

  const DEFAULT_PAGE_SIZE = globalOpts.defaultDBPageSize || 100;

  const FLAGS = {
    OR:       0x01,
    NOT:      0x02,
    EQUAL:    0x04,
    FUZZY:    0x08,
    GREATER:  0x10,
    SMALLER:  0x20,
    CONTAINS: 0x40,
    MATCHES:  0x80,
    JOIN:     0x100,
    WHERE:    0x200
  };

  function addCondition(_value, flags, force) {
    if (!force && (U.noe(this._currentOp) || U.noe(this._currentOp.type)))
      throw new Error('Unknown model type for query operation. Please specifiy a "type" before a field name or condition.');

    if (!force && (U.noe(this._currentOp) || U.noe(this._currentOp.field)))
      throw new Error('Unknown field for query operation. Please specify a field name before a condition.');

    var currentOp = this._currentOp;

    var value = _value;
    if (typeof value === 'function')
      value = groupCondition.call(this, value, flags);

    this._conditions.push(Object.assign({}, currentOp, {
      name: (currentOp.type && currentOp.field) ? `${currentOp.type}.${currentOp.field}` : null,
      parent: this._parent,
      depth: this._depth,
      value,
      flags: (currentOp.flags & 0x03) | (flags & ~0x03),
      group: false
    }));

    currentOp.flags = currentOp.flags & ~FLAGS.NOT;
    this._currentOpDirty = false;

    return this;
  }

  function groupCondition(cb, flags) {
    var group = new this.constructor(Object.assign({}, this._options, {
      currentOp: Object.assign({}, this._currentOp, {
        flags: (flags & FLAGS.OR)
      }),
      parent: this
    }));

    cb.call(group, group);
    group = group.finalize();

    return group;
  }

  function getFirstConditionFlags() {
    var conditions = this._conditions,
        condition;

    for (var i = 0, il = conditions.length; i < il; i++) {
      condition = conditions[i];

      if (condition instanceof QueryBuilder) {
        var ret = getFirstConditionFlags.call(condition);
        if (ret === undefined)
          continue;
      }

      break;
    }

    return (condition) ? condition.flags : undefined;
  }

  function lazyCollectionMethodHelper(funcName, args) {
    this.finalize();

    // Create a new promise and return immediately
    return new Promise((resolve, reject) => {
      // Wait for the LazyCollection from the DB query
      this.exec().then((collection) => {
        var ret = collection;
        if (collection instanceof LazyCollection) {
          // We got the collection, now act upon it
          ret = collection[funcName](...args);
        }

        // If the return value from the collections method is a promise, then wait again
        // ... else resolve with the return value immediately
        if (ret && typeof ret.then === 'function')
          ret.then(resolve, reject);
        else
          resolve(ret);
      }, reject);
    });
  }

  class QueryBuilder extends Chainable {
    constructor(_opts) {
      super(_opts);

      var opts = Object.assign({ ascending: true }, _opts || {});

      U.defineRWProperty(this, '_options', opts);
      U.defineROProperty(this, 'group', true);
      U.defineRWProperty(this, '_conditions', []);
      U.defineRWProperty(this, '_parent', opts.parent || null);
      U.defineRWProperty(this, '_depth', this.getDepth());
      U.defineRWProperty(this, '_currentOp', opts.currentOp || {
        field: null,
        flags: 0
      });

      U.defineRWProperty(this, '_currentOpDirty', false);

      return this.start(opts);
    }

    getOnExec() {
      return this._options.onExec;
    }

    setOnExec(func) {
      this._options.onExec = func;
    }

    getConditions() {
      return this._conditions;
    }

    setConditions(conditions) {
      this._conditions = conditions;
    }

    getParent() {
      return this._parent;
    }

    getDepth() {
      var depth = 0,
          parent = this;

      while (parent && parent._parent) {
        depth++;
        parent = parent._parent;
      }

      return depth;
    }

    getRoot() {
      var parent = this;
      while (parent && parent._parent)
        parent = parent._parent;

      return parent;
    }

    getAllTypes() {
      const _getAllTypes = (qb, types) => {
        var conditions = qb.getConditions();
        for (var i = 0, il = conditions.length; i < il; i++) {
          var condition = conditions[i];

          if (condition.group)
            _getAllTypes(condition, types);
          else
            types[condition.type] = true;
        }

        return types;
      };

      return Object.keys(_getAllTypes(this, {}));
    }

    getAllFields() {
      const _getAllFields = (qb, fields) => {
        for (var condition of qb.values()) {
          if (condition.group)
            _getAllFields(condition, fields);
          else
            fields[condition.name] = true;
        }

        return fields;
      };

      return Object.keys(_getAllFields(this, {}));
    }

    pageSize(pageSize) {
      var options = this._options;
      if (arguments.length === 0)
        return options.pageSize || DEFAULT_PAGE_SIZE;

      options.pageSize = pageSize;
    }

    $pageSize() {
      if (!arguments.length)
        return;

      this.pageSize.apply(this, arguments);

      return this;
    }

    limit(limit) {
      var options = this._options;
      if (arguments.length === 0)
        return options.limit;

      options.limit = limit;
    }

    $limit() {
      if (!arguments.length)
        return;

      this.limit.apply(this, arguments);

      return this;
    }

    offset(offset) {
      var options = this._options;
      if (arguments.length === 0)
        return options.offset;

      options.offset = offset;
    }

    $offset() {
      if (!arguments.length)
        return;

      this.offset.apply(this, arguments);

      return this;
    }

    orderAscending(isAscending) {
      var root = this.getRoot(),
          options = root._options;

      if (arguments.length === 0)
        return options.ascending;

      options.ascending = isAscending;
    }

    $orderAsc() {
      if (!arguments.length)
        return;

      this.orderAscending.call(this, true);

      return this;
    }

    $orderDesc() {
      if (!arguments.length)
        return;

      this.orderAscending.call(this, false);

      return this;
    }

    formatOrder(_order) {
      var root = this.getRoot(),
          options = root._options,
          order = _order,
          orderAscending = options.ascending;

      // Add "ASC" by default if order part doesn't have it
      if (!order)
        return order;

      return ('' + order).replace(/['"`]/g, '').replace(/^\s*([^,]+)/, function(m, p) {
        var parts = p.split(/\s+/);
        if (parts.length >= 2)
          return m;

        return `${parts[0]} ${(orderAscending) ? 'ASC' : 'DESC'}`;
      });
    }

    order(_order) {
      var options = this._options;
      if (arguments.length === 0)
        return this.formatOrder(options.order);

      var order = options.order = this.formatOrder(_order),
          orders = (order) ? ('' + order).split(/\s*,\s*/g) : null;

      // On set, modify options.ascending if an asc/desc flag was specified
      if (orders && orders.length) {
        ('' + orders[0]).replace(/^\s*([^,]+)/, function(m, p) {
          var parts = p.split(/\s+/);
          if (parts.length > 2)
            options.ascending = (('' + parts[1]).toLowerCase().charAt(0) === 'a');
        });
      }
    }

    $order() {
      if (!arguments.length)
        return;

      this.order.apply(this, arguments);

      return this;
    }

    finalize() {
      if (this._currentOpDirty)
        addCondition.call(this, undefined, 0, true);

      this._currentOp = null;

      // Make sure join is always first
      this._conditions.sort((a, b) => {
        var x = (a.flags & FLAGS.JOIN) ? 1 : 0,
            y = (b.flags & FLAGS.JOIN) ? 1 : 0;

        return (y - x);
      });

      return super.finalize();
    }

    exec(opts) {
      this.finalize();

      var onExec = this.getOnExec();
      if (typeof onExec === 'function')
        return onExec.call(this, this, opts);
      else
        throw new Error('This query can not be executed upon');
    }

    getFirstConditionFlags() {
      var flags = getFirstConditionFlags.call(this);
      return (flags) ? flags : 0;
    }

    *keys() {
      var conditions = this._conditions,
          fields = {};

      for (var i = 0, il = conditions.length; i < il; i++) {
        var condition = conditions[i];
        if (condition.group !== false)
          continue;

        fields[condition.name] = true;
      }

      var keys = Object.keys(fields);
      for (var i = 0, il = keys.length; i < il; i++)
        yield keys[i];
    }

    *values() {
      var conditions = this._conditions;

      for (var i = 0, il = conditions.length; i < il; i++) {
        var condition = conditions[i];
        yield condition;
      }
    }

    *entries() {
      var conditions = this._conditions;

      for (var i = 0, il = conditions.length; i < il; i++) {
        var condition = conditions[i];
        yield [ condition.name, condition ];
      }
    }

    serialize() {
      var serializer = new QueryBuilderSerializer(this);
      return serializer.serialize();
    }

    static unserialize(str) {
      var unserializer = new QueryBuilderUnserializer(str);
      return unserializer.unserialize().finalize();
    }

    first(...args) {
      this.limit(1);
      return lazyCollectionMethodHelper.call(this, 'first', args);
    }

    $first() {
      return this.first();
    }

    all(...args) {
      return lazyCollectionMethodHelper.call(this, 'all', args);
    }

    $all() {
      return this.all();
    }

    last(...args) {
      this.limit(1);
      this.orderAscending(!this.orderAscending());
      return lazyCollectionMethodHelper.call(this, 'last', args);
    }

    $last() {
      return this.last();
    }

    index(...args) {
      return lazyCollectionMethodHelper.call(this, 'index', args);
    }

    slice(...args) {
      return lazyCollectionMethodHelper.call(this, 'slice', args);
    }

    map(...args) {
      return lazyCollectionMethodHelper.call(this, 'map', args);
    }

    forEach(...args) {
      return lazyCollectionMethodHelper.call(this, 'forEach', args);
    }

    reduce(...args) {
      return lazyCollectionMethodHelper.call(this, 'reduce', args);
    }

    reduceRight(...args) {
      return lazyCollectionMethodHelper.call(this, 'reduceRight', args);
    }

    // This is a catch all for any named property that isn't defined as a $functionName
    $_default(name) {
      this._currentOp.field = name;
      return this;
    }

    $field(name) {
      // Return if this is not a set
      if (arguments.length === 0)
        return;

      this._currentOp.field = name;
      return this;
    }

    $model(modelName) {
      // Return if this is not a set
      if (arguments.length === 0)
        return;

      this._currentOpDirty = (this._currentOp.type !== modelName);
      this._currentOp.type = modelName;

      return this;
    }

    $not(cb) {
      var flags = this._currentOp.flags;
      if (typeof cb === 'function') {
        var group = groupCondition.call(this, cb, flags ^ FLAGS.NOT);
        if (group._conditions.length)
          this._conditions.push(group);

        this._currentOpDirty = false;

        return this;
      }

      // Toggle "NOT"
      this._currentOp.flags = flags ^ FLAGS.NOT;
      this._currentOpDirty = true;

      return this;
    }

    $and(cb) {
      var flags = this._currentOp.flags;
      if (flags & FLAGS.NOT)
        throw new Error('QueryBuilder: Can not place a NOT condition immediately before an AND');

      if (typeof cb === 'function') {
        var group = groupCondition.call(this, cb, flags & ~FLAGS.OR);
        if (group._conditions.length)
          this._conditions.push(group);

        this._currentOpDirty = false;

        return this;
      }

      // Turn off "OR"
      this._currentOp.flags = flags & ~FLAGS.OR;
      this._currentOpDirty = true;

      return this;
    }

    $or(cb) {
      var flags = this._currentOp.flags;
      if (flags & FLAGS.NOT)
        throw new Error('QueryBuilder: Can not place a NOT condition immediately before an OR');

      if (typeof cb === 'function') {
        var group = groupCondition.call(this, cb, flags | FLAGS.OR);
        if (group._conditions.length)
          this._conditions.push(group);

        this._currentOp.flags = flags & ~FLAGS.OR;
        this._currentOpDirty = false;

        return this;
      }

      // Turn on "OR"
      this._currentOp.flags = flags | FLAGS.OR;
      this._currentOpDirty = true;

      return this;
    }

    $is(value) {
      // Return if this is not a set
      if (arguments.length === 0)
        return;

      return this.$equals.call(this, value);
    }

    $eq(value) {
      // Return if this is not a set
      if (arguments.length === 0)
        return;

      return this.$equals.call(this, value);
    }

    $matches(value) {
      // Return if this is not a set
      if (arguments.length === 0)
        return;

      if (typeof value === 'function')
        throw new Error('"matches" must be an identifier, not a function');

      return this.$equals.call(this, value, FLAGS.MATCHES);
    }

    $equals(val, extraFlags = 0) {
      // Return if this is not a set
      if (arguments.length === 0)
        return;

      return addCondition.call(this, val, FLAGS.EQUAL | extraFlags);
    }

    $join(cb) {
      // Return if this is not a set
      if (arguments.length === 0)
        return;

      if (typeof cb !== 'function')
        throw new Error('"on" must have a callback as the first argument');

      var ret = addCondition.call(this, cb, FLAGS.JOIN, true);

      // Turn off "OR"
      this._currentOp.flags = this._currentOp.flags & ~FLAGS.JOIN;

      return ret;
    }

    $cont() {
      return this.$contains.apply(this, arguments);
    }

    $oneOf() {
      return this.$contains.apply(this, arguments);
    }

    $contains(val) {
      // Return if this is not a set
      if (arguments.length === 0)
        return;

      return addCondition.call(this, val, FLAGS.CONTAINS);
    }

    $like(val) {
      // Return if this is not a set
      if (arguments.length === 0)
        return;

      return addCondition.call(this, val, FLAGS.EQ | FLAGS.FUZZY);
    }

    $between(min, max, inclusive) {
      // Return if this is not a set
      if (arguments.length === 0)
        return;

      var flags = this._currentOp.flags,
          not = (flags & FLAGS.NOT);

      groupCondition.call(this, (group) => {
        var greater = (inclusive) ? (FLAGS.GREATER | FLAGS.EQUAL) : (FLAGS.GREATER),
            smaller = (inclusive) ? (FLAGS.SMALLER | FLAGS.EQUAL) : (FLAGS.SMALLER);

        addCondition.call(group, min, (not) ? smaller : greater);

        if (not)
          group.or();
        else
          group.and();

        addCondition.call(group, max, (not) ? greater : smaller);
      }, flags & ~FLAGS.NOT);

      this._currentOp.flags = flags & ~FLAGS.NOT;

      return this;
    }

    $gt() {
      return this.$greaterThan.apply(this, arguments);
    }

    $gte(val) {
      return this.$greaterThan.call(this, val, true);
    }

    $greaterThan(val, inclusive) {
      // Return if this is not a set
      if (arguments.length === 0)
        return;

      return addCondition.call(this, val, (inclusive) ? (FLAGS.GREATER | FLAGS.EQUAL) : (FLAGS.GREATER));
    }

    $lt() {
      return this.$lessThan.apply(this, arguments);
    }

    $lte(val) {
      return this.$lessThan.call(this, val, true);
    }

    $lessThan(val, inclusive) {
      // Return if this is not a set
      if (arguments.length === 0)
        return;

      return addCondition.call(this, val, (inclusive) ? (FLAGS.SMALLER | FLAGS.EQUAL) : (FLAGS.SMALLER));
    }

    toSQL(schema, _opts) {
      const limitOrderOffset = ({ limit, order, offset }) => {
        var parts = [];

        if (order) {
          parts.push(`ORDER BY ${order.replace(/['"`]/g, '').replace(/^\s*(\S+)(.*?)$/g, (m, p1, _p2) => {
            var p2 = _p2;
            if (!p2)
              p2 = '';

            return `${namespaceIdentifier(p1)}${p2}`;
          })}`);
        }

        if (limit)
          parts.push(`LIMIT ${limit}`);

        if (offset != null || (typeof offset === 'number' && isFinite(offset)))
          parts.push(`OFFSET ${offset}`);

        return (parts.length) ? ` ${parts.join(' ')}` : '';
      };

      const getSchemaField = ({ type, field }) => {
        if (!schema)
          return;

        var schemaDefinition = schema.getModelSchema(type);
        if (!schemaDefinition) {
          Logger.warn(`Attempting to query using model type "${type}" but no such model is defined in the schema. Ignoring.`);
          return;
        }

        var fields = schemaDefinition.getFields();
        if (fields && !fields.hasOwnProperty(field))
          return;

        return fields[field];
      };

      const queryConditionalToString = (condition, parentCondition, builderFlags, depth) => {
        const greaterLessThen = (invert) => {
          var op = [];
          if (flags & FLAGS.NOT) {
            op.push((!invert) ? '<' : '>');
            if (!(flags & FLAGS.EQUAL))
              op.push('=');
          } else {
            op.push((!invert) ? '>' : '<');
            if (flags & FLAGS.EQUAL)
              op.push('=');
          }

          value = (value instanceof QueryBuilder) ? queryToString(value, condition, builderFlags, depth + 1) : escapeFunc(value);
          return { value: `${resourceName}${op.join('')}${value}` };
        };

        var schemaField = getSchemaField(condition),
            { field, flags, value, type } = condition,
            resourceName = field;

        resourceName = `${identifierFunc(modelToTableName(type))}.${identifierFunc(fieldToColumnName(type, field))}`;
        field = identifierFunc(`${type}.${field}`);

        if (schemaField && schemaField.type === 'boolean')
          value = (!!value) ? 1 : 0;

        if (flags & FLAGS.CONTAINS) {
          value = (value instanceof QueryBuilder) ? queryToString(value, condition, builderFlags, depth + 1) : value.map((v) => escapeFunc(v)).join(',');
          return { value: `${resourceName} ${(flags & FLAGS.NOT) ? 'NOT ' : ''}IN (${value})` };
        } else if (flags & FLAGS.GREATER) {
          return greaterLessThen(false);
        } else if (flags & FLAGS.SMALLER) {
          return greaterLessThen(true);
        } else if (flags & (FLAGS.EQUAL | FLAGS.FUZZY)) {
          if (flags & FLAGS.FUZZY) {
            if (!value)
              throw new Error('Value can not be NULL for LIKE condition');

            if (flags & FLAGS.MATCHES)
              throw new Error('"matches" can not be used in combination with "like"');

            value = (value instanceof QueryBuilder) ? queryToString(value, condition, builderFlags, depth + 1) : escapeFunc(value).replace(/_/g, '\\_').replace(/[*?]/g, function(m) {
              return (m === '*') ? '%' : '_';
            });

            return { value: `${resourceName} LIKE ${value}` };
          } else {
            var isNull = (value === undefined || value === null),
                op = '';

            if (value instanceof QueryBuilder)
              value = queryToString(value, condition, builderFlags, depth + 1);
            else if (flags & FLAGS.MATCHES)
              value = `${namespaceIdentifier(condition.value)}`;
            else
              value = escapeFunc(value);

            if (flags & FLAGS.NOT) {
              if (isNull)
                op = 'IS NOT';
              else
                op = '!=';
            } else {
              if (isNull)
                op = 'IS';
              else
                op = '=';
            }

            return { value: `${resourceName}${op}${value}` };
          }
        } else if (flags & FLAGS.JOIN) {
          if (!value || !value.group)
            throw new Error('"join" condition must have a QueryBuilder as a value');

          var allModels = value.getAllTypes(),
              onQuery = queryToString(value, condition, builderFlags, depth + 1);

          if (U.noe(allModels))
            throw new Error('"join" condition has no models to join against');

          if (U.noe(onQuery))
            throw new Error('"join" condition has no valid "on" condition');

          return { value: `JOIN ${allModels.map(identifierFunc).join(' ')} ON (${onQuery})` };
        }
      };

      const queryToString = (queryBuilder, parentCondition, _builderFlags, depth = 0) => {
        var queryStr = [],
            conditions = queryBuilder.getConditions(),
            builderFlags = _builderFlags || 0;

        for (var i = 0, il = conditions.length; i < il;) {
          var condition = conditions[i],
              thisQueryPart = null,
              offset = i + 1,
              thisConditionFlags;

          if (condition.group === true) {
            thisConditionFlags = condition.getFirstConditionFlags();

            // This is a group, so recurse
            thisQueryPart = `${queryToString(condition, parentCondition, builderFlags, depth + 1)}`;
          } else {
            thisConditionFlags = condition.flags;

            var compiledConditional = queryConditionalToString(condition, parentCondition, builderFlags, depth);
            if (compiledConditional) {
              thisQueryPart = compiledConditional.value;

              if (compiledConditional.offset != null)
                offset = compiledConditional.offset;
            }
          }

          if (thisQueryPart) {
            if (!(condition.flags & FLAGS.JOIN)) {
              if (depth === 0 && !(builderFlags & FLAGS.WHERE)) {
                queryStr.push(' WHERE ');
                builderFlags = builderFlags | FLAGS.WHERE;
              } else if (queryStr.length) {
                queryStr.push((thisConditionFlags & FLAGS.OR) ? ' OR ' : ' AND ');
              }
            }

            // Add sub where-clause
            queryStr.push(thisQueryPart);
          }

          if (offset < 1)
            break;

          i = offset;
        }

        var finalStr = queryStr.join('');
        return (depth > 0 && queryStr.length > 1) ? `(${finalStr})` : finalStr;
      };

      var opts = _opts || {},
          tableMap = opts.tableMap,
          fieldMap = opts.fieldMap,
          getModelNames = (queryBuilder) => {
            var modelNames = {},
                conditions = queryBuilder.getConditions();

            for (var i = 0, il = conditions.length; i < il; i++) {
              var condition = conditions[i];
              if (condition.group || !condition.type)
                continue;

              modelNames[condition.type] = true;
            }

            return Object.keys(modelNames);
          },
          identifierFunc = opts.identifier || ((value) => `"${value}"`),
          namespaceIdentifier = opts.namespaceIdentifier || ((value) => {
            return value.replace(/['"`]/g, '').split(/\./).filter(Boolean).map((part) => identifierFunc(part)).join('.');
          }),
          escapeFunc = opts.escape || SQLString.escape,
          modelToTableName = opts.modelNameToTableName || ((modelName) => {
            if (tableMap && tableMap[modelName])
              return tableMap[modelName];

            return modelName;
          }),
          fieldToColumnName = opts.fieldToColumnName || ((modelName, fieldName) => {
            var modelFieldMap = (fieldMap && tableMap[modelName]);
            if (modelFieldMap && modelFieldMap[fieldName])
              return modelFieldMap[fieldName];

            return fieldName;
          }),
          fields = [],
          modelNames = getModelNames(this),
          modelName = modelNames[0],
          qb = this.finalize(),
          limitOrderOffsetOpts = D.extend(D.extend.FILTER, (key, value) => (value != null), {}, this._options, opts);

      if (!modelName)
        throw new Error('Unknown model to query against');

      if (modelNames.length > 1 && !this.getParent())
        throw new Error('There is currently no support for querying against multiple tables at the same time');

      var tableName = modelToTableName(modelName);

      // Specify default order if an order is not specified
      if (schema && !limitOrderOffsetOpts.order) {
        var modelSchema = schema.getModelSchema(modelName),
            defaultOrderByField = (modelSchema && modelSchema.getDefaultOrderByField());

        if (defaultOrderByField)
          limitOrderOffsetOpts.order = `${modelName}.${defaultOrderByField.name} ${(limitOrderOffsetOpts.ascending) ? 'ASC' : 'DESC'}`;
      }

      if (opts.onlyCount) {
        fields = ['count(*)'];
      } else if (opts.fields) {
        fields = opts.fields.filter(Boolean).map((_field) => {
          var thisModelName,
              field = _field;

          if (field.indexOf('.') >= 0)
            [ thisModelName, field ] = field.split(/\./g).filter(Boolean);

          if (!thisModelName)
            thisModelName = modelName;

          if (schema && field === '__primaryKey') {
            var modelSchema = schema.getModelSchema(thisModelName),
                primaryKeyField = (modelSchema && modelSchema.getPrimaryKeyField());

            if (!primaryKeyField)
              throw new Error(`Requested primary key from model ${thisModelName} but no such model was found.`);

            field = primaryKeyField.name;
          }

          return `${identifierFunc(modelToTableName(modelName))}.${identifierFunc(fieldToColumnName(modelName, field))} as ${identifierFunc(`${thisModelName}.${field}`)}`;
        });
      } else if (schema) {
        var modelSchema = schema.getModelSchema(modelName);

        fields = (modelSchema && modelSchema.getFields());
        if (fields) {
          var fieldNames = Object.keys(fields);
          fields = fieldNames.map((fieldName) => `${identifierFunc(tableName)}.${identifierFunc(fieldName)} as ${identifierFunc(`${modelName}.${fieldName}`)}`);
        }
      } else {
        fields = ['*'];
      }

      var finalQueryStr;

      if (fields && fields.length && !opts.whereOnly)
        finalQueryStr = `SELECT ${fields.join(',')} FROM ${identifierFunc(tableName)} ${queryToString(qb, null, (opts.whereOnly) ? FLAGS.WHERE : 0)}${limitOrderOffset(limitOrderOffsetOpts)}`;
      else
        finalQueryStr = queryToString(qb);

      return finalQueryStr;
    }
  }

  // Set static property FLAGS on the class
  QueryBuilder.FLAGS = FLAGS;

  class QueryBuilderSerializer {
    constructor(queryBuilder) {
      if (!(queryBuilder instanceof QueryBuilder))
        throw new Error('QueryBuilderSerializer constructor requires a QueryBuilder instance');

      U.defineRWProperty(this, 'queryBuilder', queryBuilder);
      U.defineRWProperty(this, 'currentType', null);
    }

    binaryOpToString(flags) {
      return (flags & FLAGS.OR) ? '|' : '&';
    }

    fieldOpToString(flags) {
      var output = [];

      if (flags & (FLAGS.GREATER | FLAGS.SMALLER))
        output.push((flags & FLAGS.GREATER) ? '>' : '<');
      else if (flags & FLAGS.NOT)
        output.push('!');

      if (flags & FLAGS.EQUAL)
        output.push('=');
      else if (flags & FLAGS.FUZZY)
        output.push('%');
      else if (flags & FLAGS.CONTAINS)
        output.push('~');

      return output.join('');
    }

    fieldToString(type, name) {
      return `${type}:${name}`;
    }

    valueToString(value) {
      return JSON.stringify(value);
    }

    serializeConditions(queryBuilder) {
      var conditions = queryBuilder.getConditions(),
          output = [JSON.stringify([
            queryBuilder.order(),
            queryBuilder.limit(),
            queryBuilder.offset(),
            queryBuilder.pageSize()
          ])],
          currentType = this.currentType;

      for (var i = 0, il = conditions.length; i < il; i++) {
        var condition = conditions[i];

        if (condition instanceof QueryBuilder) {
          var firstCondition = condition._conditions[0];
          if (!firstCondition)
            continue;

          if (i !== 0)
            output.push(this.binaryOpToString(firstCondition.flags));

          output.push(`(${this.serializeConditions(condition)})`);
        } else {
          let value = condition.value;
          if (value === null || value === undefined)
            value = '';
          else
            value = value.valueOf();

          if (i !== 0)
            output.push(this.binaryOpToString(condition.flags));

          if (currentType !== condition.type)
            currentType = this.currentType = condition.type;

          output.push(this.fieldToString(currentType, condition.field));
          output.push(this.fieldOpToString(condition.flags));
          output.push(this.valueToString(value));
        }
      }

      return output.join('');
    }

    serialize() {
      this.currentType = null;
      return this.serializeConditions(this.queryBuilder.getRoot());
    }
  }


  class QueryBuilderUnserializer {
    constructor(serializedString, QueryBuilderClass = QueryBuilder) {
      if (!serializedString)
        throw new Error('QueryBuilderUnserializer constructor requires a serialized QueryBuilder string');

      U.defineRWProperty(this, 'QueryBuilderClass', QueryBuilderClass);
      U.defineRWProperty(this, 'serializedString', serializedString);
      U.defineRWProperty(this, 'serializedStringLength', serializedString.length);

      // Parser has a shared "state" to pass values between parsing functions to be nicer on the garbage collector
      U.defineRWProperty(this, 'parserState', { offset: 0, type: null, value: null });
    }

    parseRegExp(re, offset) {
      re.lastIndex = offset;
      var m = re.exec(this.serializedString);

      if (m.index !== offset)
        throw new Error('QueryBuilderUnserializer: unexpected end of input');

      var state = this.parserState;
      state.offset = offset + m[0].length;
      state.value = m[0];

      return state;
    }

    parseString(offset) {
      var lastChar,
          parsedStr = [],
          c,
          str = this.serializedString,
          strLen = this.serializedStringLength,
          state = this.parserState;

      for (var i = offset; i < strLen; i++) {
        lastChar = c;
        c = str.charAt(i);

        if (c === '\\') {
          if (lastChar === '\\')
            parsedStr.push(c);

          continue;
        } else if (c === '"' && lastChar !== '\\') {
          state.offset = i + 1;
          state.value = parsedStr.join('');
          return state;
        }

        parsedStr.push(c);
      }

      throw new Error('QueryBuilderUnserializer: unexpected end of input');
    }

    parseFieldName(offset) {
      var str = this.serializedString,
          thisParsed = (str.charAt(offset) === '"') ? this.parseString(offset + 1) : this.parseRegExp(/[^!><=%~]+/g, offset),
          parts = thisParsed.value.split(':');

      if (!parts || parts.length !== 2)
        throw new Error(`QueryBuilderUnserializer: no type specified for field: ${thisParsed.value}`);

      if (parts[0].length)
        thisParsed.type = parts[0];

      thisParsed.value = parts[1];

      return thisParsed;
    }

    parseFieldOp(offset) {
      return this.parseRegExp(/[!><=%~]+/g, offset);
    }

    fieldOpToFlags(op) {
      var flags = 0,
          opMap = {
            '=': FLAGS.EQUAL,
            '>': FLAGS.GREATER,
            '<': FLAGS.SMALLER,
            '!': FLAGS.NOT,
            '~': FLAGS.CONTAINS,
            '%': FLAGS.FUZZY
          };

      for (var i = 0, il = op.length; i < il; i++) {
        var c = op.charAt(i),
            flag = opMap[c];

        if (!flag)
          throw new Error(`QueryBuilderUnserializer: unknown op symbol encountered: "${c}"`);

        flags = flags | flag;
      }

      return flags;
    }

    parseAllValues(offset) {
      var values = [],
          str = this.serializedString,
          strLen = this.serializedStringLength,
          state = this.parserState;

      for (var i = offset; i < strLen;) {
        this.parseFieldValue(i);
        values.push(state.value);
        i = state.offset;

        if (str.charAt(i) !== ',') {
          state.offset = state.offset + 1;
          state.value = values;
          return state;
        }

        i++;
      }

      throw new Error('QueryBuilderUnserializer: unexpected end of input');
    }

    parseFieldValue(offset) {
      var str = this.serializedString,
          c = str.charAt(offset),
          state = this.parserState;

      if (c === '"')
        return this.parseString(offset + 1);
      else if (c === '[')
        return this.parseAllValues(offset + 1);

      this.parseRegExp(/(true|false|[e\d.-]+)/g, offset);
      var value = state.value;

      if (value === 'true')
        state.value = true;
      else if (value === 'false')
        state.value = false;
      else
        state.value = parseFloat(value);

      return state;
    }

    parseCondition(offset, flags) {
      var parts = [],
          state = this.parserState;

      this.parseFieldName(offset);
      parts.push(state.value);

      this.parseFieldOp(state.offset);
      parts.push(state.value);

      this.parseFieldValue(state.offset);
      parts.push(state.value);

      state.value = {
        field: parts[0],
        type: state.type,
        flags: this.fieldOpToFlags(parts[1]) | flags,
        value: parts[2]
      };

      return state;
    }

    parseGroup(_offset, binOp) {
      var offset = _offset,
          conditions = [],
          binaryOp = binOp,
          str = this.serializedString,
          strLen = this.serializedStringLength,
          state = this.parserState,
          header = this.parseHeader(offset),
          options;

      if (header) {
        options = header.options;
        state.offset = offset = header.offset;
      }

      for (var i = offset; i < strLen;) {
        var c = str.charAt(i);

        if (c === '(') {
          state.value = this.parseGroup(i + 1, binaryOp);
        } else if (c === ')') {
          break;
        } else if (c === '&' || c === '|') {
          binaryOp = (c === '&') ? 0 : FLAGS.OR;
          i++;
          continue;
        } else {
          this.parseCondition(i, binaryOp);
          if (!state.type)
            throw new Error('QueryBuilderUnserializer: expected a type, but none was specified');
        }

        conditions.push(state.value);
        i = state.offset;
      }

      state.offset = i + 1;

      return this.conditionsToQueryBuilder(options, conditions);
    }

    conditionsToQueryBuilder(options, conditions) {
      var queryBuilder = new this.QueryBuilderClass(options);
      queryBuilder.setConditions(conditions);

      return queryBuilder;
    }

    parseHeader(currentOffset) {
      var re = /^(\[[^\]]+\])/;

      re.lastIndex = currentOffset;

      var header = this.serializedString.match(re);
      if (!header)
        return;

      var options = JSON.parse(header[1]);
      return {
        offset: currentOffset + header[1].length,
        options: {
          order: options[0],
          limit: options[1],
          offset: options[2],
          pageSize: options[3]
        }
      };
    }

    unserialize() {
      // Reset parser state
      var state = this.parserState;
      state.offset = 0;
      state.type = null;
      state.value = null;

      return this.parseGroup(0, 0);
    }
  }

  return {
    QueryBuilder,
    QueryBuilderSerializer,
    QueryBuilderUnserializer
  };
});

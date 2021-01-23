const { parseURIParts, memoizeModule } = require('../base-utils');

module.exports = memoizeModule(function(_globalOpts) {
  const globalOpts = _globalOpts || {},
        path = require('path'),
        U = require('evisit-js-utils').utils;

  // This function will intelligently break up
  // nested transactions into multiple SQL query groups
  function flattenQueries(_statements, _opts) {
    const doFlatten = (_statements) => {
      if (!_statements)
        return { before: [], transactions: [], after: [] };

      var before = [],
          transactions = [],
          after = [],
          queries = ((Array.isArray(_statements)) ? _statements : [_statements]).map((query) => {
            return (query && !query.query) ? { query } : query;
          }),
          state = 0;

      for (var i = 0, il = queries.length; i < il; i++) {
        var query = queries[i];
        if (U.noe(query))
          continue;

        var statement = query.query;
        if (U.noe(statement))
          continue;

        // Handle array of queries
        if (Array.isArray(statement)) {
          var flattened = doFlatten(statement);
          before = before.concat(flattened.before);
          transactions = transactions.concat(flattened.transactions);
          after = after.concat(flattened.after);
          continue;
        }

        statement = statement.trim();
        if (statement.match(/^begin/i)) {
          state = 1;
          continue;
        } else if (statement.match(/^commit/i)) {
          state = 2;
          continue;
        }

        query.query = statement;
        if (state === 0)
          before.push(query);
        else if (state === 1)
          transactions.push(query);
        else if (state === 2)
          after.push(query);
      }

      // There were no BEGIN transactions?
      if (transactions.length === 0) {
        transactions = before;
        before = [];
      }

      return { before, transactions, after };
    };

    var opts = _opts || {},
        { before, transactions, after } = doFlatten(_statements),
        finalBefore = [],
        finalAfter = [];

    before.forEach((item) => {
      var itemQuery = item.query;
      if (!finalBefore.find((query) => query.query === itemQuery))
        finalBefore.push(item);
    });

    after.forEach((item) => {
      var itemQuery = item.query;
      if (!finalAfter.find((query) => query.query === itemQuery))
        finalAfter.push(item);
    });

    return [].concat(finalBefore, (opts.isTransaction) ? { query: 'BEGIN TRANSACTION', required: true } : [], transactions, (opts.isTransaction) ? { query: 'COMMIT', required: true } : [], finalAfter);
  }

  function parseConnectionString(_connectionString) {
    if (!_connectionString)
      return {};

    var connection = parseURIParts(('' + _connectionString), { convertParams: true });
    if (connection.resource)
      connection.resource = connection.resource.replace(/\//g, path.sep);

    return connection;
  }

  return {
    flattenQueries,
    parseConnectionString
  };
});

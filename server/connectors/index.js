const { memoizeModule } = require('../base-utils');

module.exports = memoizeModule(function(_globalOpts) {
  const globalOpts = _globalOpts || {},
        { BaseSQLConnector } = require('./base-sql-connector')(globalOpts),
        { SQLiteConnector } = require('./sqlite-connector')(globalOpts);

  return {
    BaseSQLConnector,
    SQLiteConnector
  };
});

/*
  Modified sql-connection-wrapper from Xoumz project (https://github.com/th317erd/xoumz)
  used and modified by permission of the author (Wyatt Greenway) - 09/02/2018
*/

/*
 * SQLConnectionWrapper
 ** Normalize a connection interface for databases
 ** that don't support true connections or connection pools (SQLite)
 */

const { memoizeModule } = require('../base-utils');

module.exports = memoizeModule(function(_globalOpts) {
  const globalOpts = _globalOpts || {},
        U = require('evisit-js-utils').utils,
        { SQLTransaction } = require('./sql-transaction')(globalOpts);

  class SQLConnectionWrapper {
    constructor(_opts) {
      var opts = Object.assign({}, _opts || {});
      if (!opts.driverConnection)
        throw new Error('"driverConnection" required to instantiate a SQLConnectionWrapper');

      if (!opts.connector)
        throw new Error('"connector" required to instantiate a SQLConnectionWrapper');

      U.defineROProperty(this, '_options', opts);

      U.defineROProperty(this, '_driverConnection', undefined, () => this._options.driverConnection, (connection) => {
        this._options.driverConnection = connection;
        return connection;
      });

      U.defineROProperty(this, '_connector', undefined, () => this._options.connector, (connector) => {
        this._options.connector = connector;
        return connector;
      });
    }

    escape(...args) {
      if (typeof this._driverConnection.escape === 'function')
        return this._driverConnection.escape(...args);

      return this._connector.escape(...args);
    }

    async release() {
      var release = this._driverConnection.release;
      if (typeof release === 'function')
        release.call(this._driverConnection);
    }

    async transaction(cb, _opts) {
      if (typeof cb !== 'function')
        throw new Error('"transaction" method called without a callback');

      var opts = Object.assign({ connection: this }, _opts || {}),
          onCreateTransaction = opts.onCreateTransaction;

      if (typeof onCreateTransaction !== 'function')
        onCreateTransaction = (connector, opts) => new SQLTransaction(opts);

      try {
        var transaction = await onCreateTransaction.call(this, this, opts);
        await cb.call(transaction, transaction, this, opts);

        var results = await transaction.flush();
        await transaction.commit();

        return results;
      } catch (e) {
        if (transaction)
          await transaction.rollback(e);

        throw new Error(`"transaction" failed with error: ${e}`);
      } finally {
        if (transaction)
          await transaction.finalize();
      }
    }

    exec(statements, _opts) {
      var opts = _opts || {};
      return this._connector.exec(this, statements, opts);
    }
  }

  return {
    SQLConnectionWrapper
  };
});

/*
  Modified sql-transaction from Xoumz project (https://github.com/th317erd/xoumz)
  used and modified by permission of the author (Wyatt Greenway) - 09/02/2018
*/

/*
 * SQLTransaction
 ** Normalize a transaction interface
 ** for compound "BEGIN"/"COMMIT" transactions
 ** for databases that don't support nested transactions
 */

const { memoizeModule } = require('../base-utils');

module.exports = memoizeModule(function(_globalOpts) {
  const globalOpts = _globalOpts || {},
        U = require('evisit-js-utils').utils;

  class SQLTransaction {
    constructor(_opts) {
      var opts = Object.assign({}, _opts || {});
      if (!opts.connection)
        throw new Error('"connection" required to instantiate a SQLTransaction');

      U.defineROProperty(this, '_options', opts);

      U.defineROProperty(this, '_connection', undefined, () => this._options.connection, (connection) => {
        this._options.connection = connection;
        return connection;
      });

      U.defineRWProperty(this, '_statements', []);
      U.defineRWProperty(this, '_transactionState', 'pending');
    }

    escape(...args) {
      return this._connection.escape(...args);
    }

    async rollback() {
      if (this._transactionState !== 'finished')
        return;

      var ret = await this._connection.exec({ query: 'ROLLBACK', que: false, required: true });

      this._transactionState = 'pending';

      return ret;
    }

    async commit() {
      if (this._transactionState !== 'finished')
        return;

      var ret = await this._connection.exec({ query: 'COMMIT', que: false, required: true });

      this._transactionState = 'pending';

      return ret;
    }

    async finalize() {

    }

    async flush(_opts) {
      var opts = Object.assign({}, _opts || {}, { isTransaction: true });

      this._transactionState = 'started';

      var ret = await this._connection.exec(this._statements, opts);

      this._transactionState = 'finished';

      return ret;
    }

    exec(_statements) {
      var statements = (Array.isArray(_statements)) ? _statements : [_statements];
      this._statements = this._statements.concat(statements);
    }
  }

  return {
    SQLTransaction
  };
});

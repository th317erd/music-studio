const { memoizeModule } = require('../base-utils');

module.exports = memoizeModule(function(_globalOpts) {
  const globalOpts = _globalOpts || {},
        { Database } = require('./database')(globalOpts);

  return {
    Database
  };
});


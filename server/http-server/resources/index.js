const { memoizeModule } = require('../../base-utils');

module.exports = memoizeModule(function(_globalOpts) {
  const globalOpts = _globalOpts || {},
        resourceUtils = require('./resource-utils')(globalOpts);

  return Object.assign({}, resourceUtils, {
  });
});


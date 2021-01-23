const { memoizeModule } = require('../base-utils');

module.exports = memoizeModule(function(_globalOpts) {
  const globalOpts = _globalOpts || {},
        { HTTPServer } = require('./http-server')(globalOpts);

  return {
    HTTPServer
  };
});


const { memoizeModule } = require('../../base-utils');

module.exports = memoizeModule(function(_globalOpts) {
  const globalOpts    = _globalOpts || {},
        { RouteBase } = require('./route-base')(globalOpts);

  class SerialPorts extends RouteBase {
    async get() {
      var app = this.getApplication();
      return this.response({});
    }
  }

  return {
    SerialPorts
  };
});

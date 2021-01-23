const { memoizeModule } = require('../../base-utils');

module.exports = memoizeModule(function(_globalOpts) {
  const globalOpts = _globalOpts || {},
        { CRUDRouteBase } = require('./crud-route-base')(globalOpts);

  class Index extends CRUDRouteBase {
    constructor(context) {
      super(context, 'preference');
    }
  }

  return {
    Index
  };
});

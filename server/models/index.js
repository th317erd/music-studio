const { memoizeModule } = require('../base-utils');

module.exports = memoizeModule(function(_globalOpts) {
  const globalOpts = _globalOpts || {},
        { ModelBase }                     = require('./model-base')(globalOpts),
        { Preference }                    = require('./preference')(globalOpts);

  return {
    ModelBase,
    Preference
  };
}, 1);

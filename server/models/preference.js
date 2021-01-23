const { memoizeModule, copyStaticMethods } = require('../base-utils');

module.exports = memoizeModule(function(_globalOpts) {
  const globalOpts    = _globalOpts || {},
        { ModelBase } = require('./model-base')(globalOpts),
        { Logger }    = require('../logger')(globalOpts);

  const Preference = copyStaticMethods(class Preference extends ModelBase {
    static getModelName() {
      return 'preference';
    }

    static getFullModelName() {
      return 'preference';
    }

    constructor(...args) {
      super(...args);
    }
  });

  return {
    Preference
  };
});

const baseConfig = require('./webpack.config.base'),
      preprocessorVariables = require('../../common/pre-processor-variables');

module.exports = Object.assign({}, baseConfig, {
  globals: {
    'global': 'window',
    'global.__DEV__': JSON.stringify(false),
    '__DEV__': JSON.stringify(false)
  },
  preprocessorVariables: Object.assign({}, preprocessorVariables.browser, { DEV: false })
});

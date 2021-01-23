const baseConfig = require('./webpack.config.base'),
      preprocessorVariables = require('../../common/pre-processor-variables');

module.exports = Object.assign({}, baseConfig, {
  globals: {
    'global': 'window',
    'global.__DEV__': JSON.stringify(true),
    '__DEV__': JSON.stringify(true)
  },
  preprocessorVariables: Object.assign({}, preprocessorVariables.browser, { DEV: true })
});

const path = require('path'),
      projectRoot = path.resolve(__dirname, '..'),
      packageJSON = require(path.resolve(projectRoot, 'package.json'));

const variables = {
  TEST: false,
  DEV: false,
  PLATFORM: 'browser',
  PLATFORM_GENERIC: 'browser',
  MOBILE: false,
  BROWSER: true,
  ELECTRON: false,
  PROJECT_ROOT: projectRoot,
  APP_NAME: packageJSON.name,
  APP_VERSION: packageJSON.version
};

module.exports = {
  browser: Object.assign({}, variables, {
    PLATFORM: 'browser',
    PLATFORM_GENERIC: 'browser',
    MOBILE: false,
    BROWSER: true,
    ELECTRON: false,
  }),
  mobile: Object.assign({}, variables, {
    PLATFORM: 'mobile',
    PLATFORM_GENERIC: 'mobile',
    MOBILE: true,
    BROWSER: false,
    ELECTRON: false,
  }),
  electron: Object.assign({}, variables, {
    PLATFORM: 'browser',
    PLATFORM_GENERIC: 'browser',
    MOBILE: false,
    BROWSER: true,
    ELECTRON: true
  })
};

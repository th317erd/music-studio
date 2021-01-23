const webpackConfigBase = require('./client/config/webpack.config.base.js');

function generateAliasConfig() {
  var resolve = webpackConfigBase.resolve || {},
      alias = resolve.alias,
      moduleNameMapper = {};

  if (alias) {
    var keys = Object.keys(alias);
    for (var i = 0, il = keys.length; i < il; i++) {
      var key = keys[i],
          thisAlias = alias[key];

      if (key.charAt(0) === '@') {
        moduleNameMapper[`^${key}$`] = thisAlias;
        moduleNameMapper[`^${key}(\/.*)$`] = `${thisAlias}$1`;
      } else {
        moduleNameMapper[`^${key}$`] = thisAlias;
      }
    }
  }

  return {
    moduleFileExtensions: (resolve.extensions || ['js', 'json']).map((ext) => ext.replace(/^\W+/g, '')),
    moduleNameMapper
  };
}

module.exports = Object.assign({
  rootDir: __dirname,
  verbose: true,
  testPathIgnorePatterns: ["<rootDir>/server", "<rootDir>/tools", "node_modules"],
  collectCoverageFrom: [
    "client/source/**/*.{js,jsx,mjs}"
  ],
  setupFiles: [
    "<rootDir>/client/test/setup.js"
  ],
  testMatch: ["<rootDir>/client/test/tests/**/*.{js,jsx,mjs}"],
  testEnvironment: "jsdom",
  testURL: "http://localhost",
  transform: {
    "^.+\\.(js|jsx|mjs)$": "<rootDir>/tools/test-transformer"
  },
  transformIgnorePatterns: [
    "[/\\\\]node_modules[/\\\\].+\\.(js|jsx|mjs)$"
  ],
  moduleFileExtensions: [
    "web.js",
    "js",
    "json",
    "web.jsx",
    "jsx",
    "node",
    "mjs"
  ]
}, generateAliasConfig());

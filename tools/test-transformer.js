const webpackConfigDev = require('../client/config/webpack.config.dev.base.js'),
      preprocessor = require('./pre-processor'),
      babel = require('@babel/core'),
      jestPreset = require('babel-preset-jest'),
      path = require('path'),
      { searchAndReplaceFactory } = require('../common/base-utils');

const babelRCPath = path.resolve(__dirname, '..', '.babelrc'),
      globalReplace = searchAndReplaceFactory(webpackConfigDev.globals);

module.exports = {
  process(src, filename, config, options) {
    var source = preprocessor.call({
      getOptions: () => Object.assign({}, webpackConfigDev.preprocessorVariables || {}, {
        TEST: true
      }),
      getFileName: () => {
        return filename;
      },
      getMacros: () => [
        globalReplace
      ]
    }, src);

    return babel.transform(source, {
      filename,
      presets: [jestPreset],
      plugins: [
        "@babel/plugin-proposal-object-rest-spread",
        '@babel/plugin-proposal-class-properties',
        "transform-dirname-filename"
      ],
      extends: babelRCPath,
      sourceRoot: config.rootDir
    });
  }
};

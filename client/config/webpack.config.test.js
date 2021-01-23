var baseConfig = require('./webpack.config.base'),
    webpack = require('webpack'),
    packageJSON = require('../../package.json');

const PATHS = baseConfig.PATHS;

module.exports = Object.assign(module.exports, baseConfig.webpack, {
  stats: false,
  performance: {
    hints: false
  },
  entry: [ 'regenerator-runtime/runtime', PATHS.APP_MAIN ],
  output: {
    path: PATHS.APP_TEST_BUNDLE,
    filename: 'client-bundle.js'
  },
  target: 'node',
  mode: 'production',
  module: {
    rules: [
      {
        test: /\.css$/,
        loader: 'style-loader!css-loader'
      },
      {
        // Most react-native libraries include uncompiled ES6 JS.
        test: /\.jsx?/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'babel-loader',
            query: {
              cacheDirectory: false,
              babelrc: false,
              presets: [
                '@babel/preset-env',
                'module:babel-preset-react-ameliorate'
              ],
              plugins: [
                '@babel/plugin-proposal-class-properties'
              ]
            }
          },
          {
            loader: './tools/pre-processor',
            options: {
              TEST: true,
              DEV: false,
              PLATFORM: 'browser',
              PLATFORM_GENERIC: 'browser',
              MOBILE: false,
              BROWSER: true,
              ELECTRON: false,
              PROJECT_ROOT: PATHS.APP_SRC,
              APP_NAME: packageJSON.name,
              APP_VERSION: packageJSON.version
            }
          }
        ]
      },
      {
        // This is needed for webpack to import static images in JavaScript files.
        test: /\.(gif|jpe?g|png|svg)$/,
        use: {
          loader: 'url-loader',
          query: { name: '[name].[ext]' }
        }
      }
    ]
  },
  plugins: [
    new webpack.DefinePlugin({
      global: 'window',
      'global.__DEV__': JSON.stringify(false),
      '__DEV__': JSON.stringify(false),
      'process.env': {
        NODE_ENV: JSON.stringify("production")
      }
    })
  ],
  // Some libraries import Node modules but don't use them in the browser.
  // Tell Webpack to provide empty mocks for them so importing them works.
  node: {
    dgram: 'empty',
    fs: 'empty',
    net: 'empty',
    tls: 'empty',
  }
});

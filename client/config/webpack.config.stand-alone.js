var PATH = require('path'),
    UglifyJSPlugin = require('uglifyjs-webpack-plugin'),
    baseConfig = require('./webpack.config.stand-alone.base'),
    webpack = require('webpack');

const PATHS = baseConfig.PATHS;

module.exports = Object.assign(module.exports, baseConfig.webpack, {
  stats: {
    warnings: false
  },
  performance: {
    hints: false
  },
  mode: 'production',
  // entry: {
  //   Application: PATHS.APP_INDEX
  // },
  output: {
    path: PATH.dirname(PATHS.APP_STAND_ALONE_BUNDLE),
    filename: PATH.basename(PATHS.APP_STAND_ALONE_BUNDLE)
  },
  devtool: 'eval-source-map',
  target: "electron-renderer",
  //target: 'web',
  // externals: [
  //   function(context, request, callback) {
  //     if (request.indexOf(PATHS.APP_SRC) === 0 || request.indexOf('.') === 0 || request.indexOf('@') === 0)
  //       return callback();
  //     callback(null, 'commonjs ' + request);
  //   }
  // ],
  module: {
    rules: [
      {
        test: /\.css$/,
        loader: 'style-loader!css-loader'
      },
      baseConfig.buildLoaderConfig(baseConfig.preprocessorVariables),
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
  optimization: {
    minimizer: [
      new UglifyJSPlugin({
        uglifyOptions: {
          beautify: false,
          mangle: {
            keep_fnames: true,
            keep_classnames: true
          },
          comments: false
        },
        cache: false,
        parallel: true,
        sourceMap: false
      })
    ]
  },
  plugins: [
    new webpack.DefinePlugin(baseConfig.globals),
    new webpack.optimize.OccurrenceOrderPlugin(),
    new webpack.LoaderOptionsPlugin({
      minimize: true,
      debug: false
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

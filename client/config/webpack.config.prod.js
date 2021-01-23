var UglifyJSPlugin = require('uglifyjs-webpack-plugin'),
    baseConfig = require('./webpack.config.prod.base'),
    webpack = require('webpack');

module.exports = Object.assign(module.exports, baseConfig.webpack, {
  stats: {
    warnings: false
  },
  performance: {
    hints: false
  },
  mode: 'production',
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
    new webpack.DefinePlugin(baseConfig.globals)
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

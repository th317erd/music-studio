var baseConfig                = require('./webpack.config.dev.base'),
    webpack                   = require('webpack'),
    FS                        = require('fs'),
    PATH                      = require('path'),
    CircularDependencyPlugin  = require('circular-dependency-plugin');

const PATHS     = baseConfig.PATHS,
      HTTPS     = (process.env.NODE_ENV !== 'test' && true),
      PROTOCOL  = (HTTPS) ? 'https' : 'http',
      PORT      = 8891,
      HOST      = 'music-studio.com';

if (HTTPS) {
  var cert  = PATH.resolve(__dirname, './certs/music-studio.com.crt'),
      key   = PATH.resolve(__dirname, './certs/music-studio.com.key');

  console.log('Using CERT ', cert);
  console.log('Using PRIVATE KEY ', key);
}

module.exports = Object.assign(module.exports, baseConfig.webpack, {
  mode: 'development',
  devServer: {
    hot: false,
    https: HTTPS,
    cert: (HTTPS) ? FS.readFileSync(cert) : undefined,
    key: (HTTPS) ? FS.readFileSync(key) : undefined,
    host: HOST,
    port: PORT,
    contentBase: PATHS.APP_PUBLIC,
    disableHostCheck: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3150',
        pathRewrite: { '^/api' : '' }
      },
      '/socket.io': {
        target: 'http://localhost:3150',
        ws: true
      }
    }
  },
  devtool: 'eval-source-map',
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [
          {
            loader: 'style-loader'
          },
          {
            loader: 'css-loader'
          }
        ]
      },
      baseConfig.buildLoaderConfig(baseConfig.preprocessorVariables),
      {
        // This is needed for webpack to import static images in JavaScript files.
        test: /\.(gif|jpe?g|png|svg)$/,
        use: [
          {
            loader: 'url-loader',
            options: {
              limit: 8192,
            }
          }
        ]
      }
    ]
  },
  plugins: [
    new webpack.DefinePlugin(baseConfig.globals),
    new CircularDependencyPlugin({
      // exclude detection of files based on a RegExp
      exclude: /(node_modules)/,
      // add errors to webpack instead of warnings
      failOnError: true,
      // set the current working directory for displaying module paths
      cwd: process.cwd(),
    })
  ],
  // Turn off performance hints during development because we don't do any
  // splitting or minification in interest of speed. These warnings become
  // cumbersome.
  performance: {
    hints: false
  }
});

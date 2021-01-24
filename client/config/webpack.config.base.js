var FS = require('fs'),
    PATH = require('path'),
    PATHS = require('./paths');

function readDirectories(rootPath, cb) {
  var files = FS.readdirSync(rootPath);

  for (var i = 0, il = files.length; i < il; i++) {
    var fileName = files[i],
        fullFileName = PATH.join(rootPath, fileName),
        stat = FS.lstatSync(fullFileName),
        isDirectory = stat.isDirectory();

    if (!isDirectory)
      continue;

    cb(fileName, fullFileName);
  }
}

function readReactAmelioratePackages(cb) {
  var rootPath = PATH.join(PATHS.REACT_AMELIORATE, 'packages');
  readDirectories(rootPath, cb);
}

function buildReactAmeliorateAliases() {
  var aliases = {};

  try {
    readReactAmelioratePackages((fileName, fullFileName) => {
      var packageName = fileName.replace(/^react-ameliorate-/, ''),
          aliasName = `@react-ameliorate/${packageName}`;

      aliases[aliasName] = fullFileName;
      aliases[`@react-ameliorate-base/${packageName}`] = fullFileName;
    });

    readDirectories(PATHS.resolvePath(PATHS.PROJECT_ROOT, 'node_modules'), (fileName, fullFileName) => {
      if (fileName.match(/(react-native|@react-ameliorate)/))
        return;

      aliases[fileName] = fullFileName;
    });
  } catch (e) {}

  return aliases;
}

function buildReactAmeliorateModules() {
  var theseModules = [];

  try {
    readReactAmelioratePackages((fileName, fullFileName) => {
      theseModules.push(fullFileName);
    });
  } catch (e) {
    theseModules.push(PATH.join(PATHS.PROJECT_ROOT, 'node_modules', '@react-ameliorate'));
  }

  return theseModules;
}

const reactAmeliorateModules = buildReactAmeliorateModules(),
      webpackResolve = {
        extensions: [ '.js', '.json' ],
        alias: Object.assign({
          'react-native-web': PATHS.resolvePath(PATHS.PROJECT_ROOT, 'node_modules', 'react-native-web'),
          '@common':      PATHS.resolvePath(PATHS.PROJECT_ROOT, 'common'),
          '@root':        PATHS.resolvePath(PATHS.APP_SRC),
          '@base':        PATHS.resolvePath(PATHS.APP_SRC, 'base'),
          '@components':  PATHS.resolvePath(PATHS.APP_SRC, 'components'),
          '@lang':        PATHS.resolvePath(PATHS.APP_SRC, 'lang'),
          '@mixins':      PATHS.resolvePath(PATHS.APP_SRC, 'mixins'),
          '@modals':      PATHS.resolvePath(PATHS.APP_SRC, 'modals'),
          '@pages':       PATHS.resolvePath(PATHS.APP_SRC, 'pages'),
          'react-native-dynamic-fonts': PATHS.resolvePath(PATHS.APP_SRC, 'base', 'shims', 'dynamic-fonts')
        }, buildReactAmeliorateAliases(), {
          '@react-ameliorate/core': PATHS.resolvePath(PATHS.APP_SRC, 'base'),
          '@react-ameliorate/styles': PATHS.resolvePath(PATHS.APP_SRC, 'base', 'theme')
        }),
        modules: ['node_modules'].concat(reactAmeliorateModules)
      };

const compilerIncludePatterns = [PATHS.APP_SRC].concat(reactAmeliorateModules);

module.exports = {
  PATHS,
  resolve: webpackResolve,
  webpack: {
    entry: {
      main: [ 'regenerator-runtime/runtime', PATHS.APP_INDEX ],
      ffmpeg_worker: [ 'regenerator-runtime/runtime', PATHS.FFMPEG_INDEX ]
    },
    output: {
      path: PATHS.APP_PUBLIC,
      publicPath: '/js/',
      filename: '[name].js'
    },
    resolve: webpackResolve,
    target: 'web',
    optimization: {
      runtimeChunk: 'single',
      removeAvailableModules: true,
      splitChunks: {
        chunks: 'all',
        minSize: 0,
        maxSize: Infinity,
        cacheGroups: {
          common: {
            test:   /[\\/]node_modules[\\/]/,
            name:   'vendor',
            chunks: 'initial',
            minChunks: 1,
            reuseExistingChunk: true
          }
        }
      }
    }
  },
  compilerIncludePatterns,
  buildLoaderConfig: (...opts) => {
    var options = Object.assign.apply(this, [{}].concat(opts.filter(Boolean)));

    return {
      // Standard js/jsx compilation.
      test: /\.jsx?$/,
      include: compilerIncludePatterns,
      use: [
        {
          loader: 'babel-loader',
          options: {
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
          options
        }
      ]
    };
  }
};

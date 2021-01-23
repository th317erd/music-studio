const baseUtils = require('./base-utils'),
      memoizeModule = baseUtils.memoizeModule,
      FS = require('fs'),
      PATH = require('path');

// Here we "memoizeModule" (cache the function call)
// because the utility functions internally have cache,
// so we want to make sure we don't spin up multiple
// caches per-unique call (unqieness based on passed in "globalOpts").
// Same "globalOpts" == same utility exports (and their scoped cache).
// This is also a requirement for requiring scoped modules the way we are,
// because in Javascript returning different exports every time
// we call the scoped module export function will result in
// different exports, which often-times can be a bad thing
// (i.e. it will break "instanceof", because classes will
// be different every export, even if their name is the same)
module.exports = memoizeModule(function(_globalOpts) {
  const globalOpts = _globalOpts || {},
        fs = require('fs'),
        path = require('path'),
        OS = require('os'),
        mkdirp = require('mkdirp'),
        U = require('evisit-js-utils').utils,
        D = require('evisit-js-utils').data,
        defaultConfig = require('./default-config')(globalOpts);

  var _cachedConfigDir = null,
      _cachedConfig = null;

  function getConfigPath() {
    if (_cachedConfigDir)
      return _cachedConfigDir;

    var appName = globalOpts.appName || 'music-studio',
        configPath = (OS.platform() === 'win32') ? path.join(OS.homedir(), appName) : path.join(OS.homedir(), '.config', appName);

    mkdirp.sync(configPath);

    _cachedConfigDir = configPath;
    return configPath;
  }

  function sanitizeConfig(config) {
    const sanitizeHTTPConfig = (sectionConfig) => {
            // Ensure port is a valid port numer
            var port = parseInt(('' + sectionConfig.port).replace(/\D/g, ''), 10);
            if (isNaN(port) || !isFinite(port))
              port = defaultConfig.DEFAULT_PORT;
            sectionConfig.port = port;

            return sectionConfig;
          },
          sanitizeDatabaseConfig = (sectionConfig) => {
            // Ensure proper database path
            var connectionString = U.get(sectionConfig, 'connectionString', U.get(defaultConfig, 'database.connectionString'));
            sectionConfig.connectionString = interpolateConfigValue(config, connectionString, true);

            return sectionConfig;
          };

    config.http = sanitizeHTTPConfig(config.http || {});
    config.database = sanitizeDatabaseConfig(config.database || {});

    return config;
  }

  function loadConfig(...args) {
    if (_cachedConfig)
      return _cachedConfig;

    var appConfigPath = getConfigPath(),
        configPath = path.join(appConfigPath, 'server.config.json'),
        config = {},
        mergeOptions = args.filter((arg) => (!!arg && arg instanceof Object));

    try {
      config = require(configPath);
    } catch (e) {
      fs.writeFileSync(configPath, JSON.stringify(defaultConfig));
      config = {};
    }

    var finalConfig = sanitizeConfig(D.extend(true, {}, defaultConfig, globalOpts, config, ...mergeOptions, {
      homePath: appConfigPath
    }));

    return finalConfig;
  }

  function interpolateConfigValue(config, _value, isPath) {
    if (!_value || typeof _value !== 'string')
      return _value;

    var homePath = U.get(config, 'homePath') + path.sep,
        value = ('' + _value).replace(/<home>/g, homePath);

    // Replace multiple path separators in sequence with a single one (but be URI-aware)
    if (isPath) {
      // Any two or more "/" consecutive forward
      // slashes that aren't prefixed by ":"
      var uriPrefix,
          uriBody;

      // capture parts
      value.replace(/^(.*?:\/\/)?(.*)$/, function(m, prefix, body) {
        uriPrefix = prefix;
        uriBody = body.replace(/([^:])[\/\\]{2,}/g, '$1/');
      });

      value = [uriPrefix, uriBody].join('');
    }

    return value;
  }

  function mkdirPathSync(dirPath) {
    var pathParts = PATH.parse(dirPath),
        dirName = PATH.normalize(dirPath),
        root = pathParts.root,
        runningPath = root;

    dirName.substring(root.length).split(PATH.sep).forEach((part) => {
      if (!part)
        return;

      runningPath = PATH.join(runningPath, part);

      try {
        if (!FS.existsSync(runningPath))
          FS.mkdirSync(runningPath);
      } catch (e) {}
    });
  }

  return  Object.assign({}, baseUtils, {
    getConfigPath,
    loadConfig,
    mkdirPathSync
  });
});

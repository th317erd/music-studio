const { memoizeModule } = require('../../base-utils');

module.exports = memoizeModule(function(_globalOpts) {
  const globalOpts = _globalOpts || {},
        routeExports = {
          'client': require('./client')(globalOpts),
          'config': require('./config')(globalOpts),
          'preference': require('./preference')(globalOpts)
        };

  if (globalOpts.development) {
    // This automatically reloads route modules (when they change)
    // while in development mode

    (function() {
      function reloadRoute(routeName, fileName) {
        // First delete require cache so the "require"
        // will reload the changed module
        delete require.cache[fileName];

        try {
          // attempt to reload the module
          routeExports[routeName] = require(fileName)(globalOpts);
          Logger.info(`Reloaded route: ${routeName}`);
        } catch (e) {
          Logger.error(`route[${routeName}]: ${e.message}\n${e.stack}`);
        }
      }

      function reloadAllRoutes() {
        // Delete cache for modules routes depend on
        delete require.cache[require.resolve('./route-base')];

        var keys = Object.keys(routeExports);
        for (var i = 0, il = keys.length; i < il; i++) {
          var routeName = keys[i];
          reloadRoute(routeName, require.resolve(`./${routeName}`));
        }
      }

      var path = require('path'),
          watch = require('node-watch'),
          { Logger } = require('../../logger')(globalOpts);

      watch(__dirname, { recursive: true }, function(eventName, fileName) {
        if (eventName !== 'update')
          return;

        var baseName = path.basename(fileName);
        if (!baseName)
          return;

        var routeName = ('' + baseName).replace(/\.\w+$/, '');
        if (routeExports.hasOwnProperty(routeName)) {
          // Reload a single route
          reloadRoute(routeName, fileName);
        } else if (routeName === 'route-base') {
          // Reload all routes
          reloadAllRoutes();
        }
      });
    })();
  }

  return {
    routes: routeExports
  };
});

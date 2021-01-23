const { memoizeModule } = require('./base-utils');

module.exports = memoizeModule(function(_globalOpts) {
  const globalOpts = _globalOpts || {},
        DEFAULT_PORT = globalOpts.DEFAULT_PORT || 3150,
        DEFAULT_HOST = globalOpts.DEFAULT_HOST || 'localhost';

  return {
    DEFAULT_PORT,
    DEFAULT_HOST,
    database: {
      connectionString: 'jdbc:sqlite://<home>/music-studio.sqlite'
    },
    http: {
      port: DEFAULT_PORT,
      host: DEFAULT_HOST
    }
  };
});



const { Application } = require('./remote-application')({
  client: true,
  development: __DEV__,
  logLevel: 'V'
});

(async function() {
  try {
    var app = global.API = new Application();
    await app.start();
  } catch (e) {
    console.error(`Application startup failed with the error: ${e.message}`);
  }
})();

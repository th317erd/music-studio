

const { ApplicationServer } = require('./server')({
  development: true,
  logLevel: 'V'
});

(async function() {
  var colors = require('colors');
  try {
    var server = new ApplicationServer();
    await server.start();
  } catch (e) {
    console.error(colors.red(`Application startup failed with the error: ${e.message}`));
    process.exit(1);
  }

})();

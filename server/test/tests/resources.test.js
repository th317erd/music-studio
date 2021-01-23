const path = require('path'),
      { buildJavascriptSourceForClient } = require('../../http-server/resources')({ test: true });

describe('Server Resources', function() {
  it('should be able to build and bundle javascript source', async function() {
    var testPath = path.resolve(__dirname, '../../http-server/resources/root/javascript/remote-application.js');
    var built = await buildJavascriptSourceForClient(testPath, { test: true });
    debugger;
  });
});

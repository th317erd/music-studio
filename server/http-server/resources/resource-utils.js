const FS = require('fs'),
      PATH = require('path'),
      browserify = require('browserify'),
      UglifyJS = require("uglify-es"),
      through = require('through'),
      preprocessorVariables = require('../../../common/pre-processor-variables'),
      { capitalize, searchAndReplaceFactory, memoizeModule } = require('../../base-utils');

module.exports = memoizeModule(function(_globalOpts) {
  const globalOpts                = Object.assign({}, _globalOpts || {}, { node: true }),
        { buildRunableTemplate }  = require('../../../common/pre-processor')(globalOpts),
        resourceCache             = {};

  async function buildJavascriptSourceForClient(fileName, _opts) {
    var cachedResource = resourceCache[fileName];
    if (cachedResource)
      return cachedResource;

    var opts = _opts || {},
        rootDir = PATH.resolve(__dirname, '../../'),
        urlBase = '/api';

    const iterateSchema = (cb) => {
      var app = this.getApplication(),
          schema = (app) ? app.getApplicationSchema() : null;

      if (!schema)
        return;

      var models = schema.getModelSchemas(),
          modelNames = Object.keys(models);

      for (var i = 0, il = modelNames.length; i < il; i++) {
        var modelName = modelNames[i],
            model = models[modelName];

        cb.call(this, model, modelName);
      }
    };

    const getPreprocessorOptions = (options, writeToOutput) => {
      const globalReplace = searchAndReplaceFactory({
        '(require\\s*\\(\\s*[\'"])@root': (m, p) => {
          return `${p}${rootDir}`;
        },
        '\\b__DEV__\\b': !!opts.DEV
      }, true);

      return Object.assign({}, preprocessorVariables.browser, _opts || {}, {
        macros: [
          globalReplace
        ],
        ITERATE_SCHEMA: (func) => {
          iterateSchema((model, modelName) => {
            var primaryKeyField = model.getPrimaryKeyField(),
                primaryKeyFieldName = (primaryKeyField && primaryKeyField.name) || 'id';

            writeToOutput(func(modelName, capitalize(modelName.replace(/[^a-z0-9]([a-z0-9])/ig, (m, p) => {
              return p.toUpperCase();
            })), { urlBase, primaryKeyFieldName }));
          });
        }
      });
    };

    if (opts.test) {
      var data = FS.readFileSync(fileName),
          template = buildRunableTemplate(fileName, ('' + data), getPreprocessorOptions),
          output = template();

      return output;
    }

    var compiledSource = await (() => {
      return new Promise((resolve, reject) => {
        browserify(fileName, { debug: true, entries: [] })
          .transform(() => {
            function write(buf) {
              data += buf;
            }

            function end() {
              var template = buildRunableTemplate(fileName, data, getPreprocessorOptions),
                  output = template();

              this.queue(output);
              this.queue(null);
            }

            var data = '';
            return through(write, end);
          })
          .bundle((err, buf) => {
            if (err)
              return reject(new Error(err));

            resolve(('' + buf));
          });
      });
    })();

    if (!opts.DEV) {
      compiledSource = UglifyJS.minify(compiledSource, {
        output: {
          beautify: false
        }
      }).code;
    }

    resourceCache[fileName] = compiledSource;

    return compiledSource;
  }

  return {
    buildJavascriptSourceForClient
  };
});


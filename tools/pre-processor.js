const loaderUtils = require("loader-utils"),
      path = require('path'),
      fs = require('fs'),
      colors = require('colors'),
      PATHS = require('../client/config/paths'),
      packageJSON = require('../package.json'),
      { buildRunableTemplate } = require('../common/pre-processor')({ node: true });

function getOptions(context) {
  if (context && context.loaders)
    return loaderUtils.getOptions(context);

  if (context && context.getOptions instanceof Function)
    return context.getOptions();

  return {};
}

function getFileName(context) {
  if (context && context.resourcePath)
    return context.resourcePath;

  if (context && context.getFileName instanceof Function)
    return context.getFileName();

  return '<unknown.js>';
}

function getMacroHelpers(context) {
  if (context && context.macros)
    return context.macros;

  if (context && context.getMacros instanceof Function)
    return context.getMacros();

  return [];
}

function debugOutput(source) {
  var index = 1;
  console.log(source.replace(/\n/g, function () {
    return '\n' + (index++) + ': ';
  }));
}

module.exports = function(source) {
  function argsToColor(args, color) {
    for (var i = 0, il = args.length; i < il; i++) {
      var arg = args[i];
      if (typeof arg === 'string' || arg instanceof String)
        args[i] = colors[color](arg);
    }

    return args;
  }

  var specifiedOptions = getOptions(this),
      fileName = getFileName(this, specifiedOptions),
      macros = getMacroHelpers(this);

  var templateOptions = (options, writeToOutput) => {
    return Object.assign({}, specifiedOptions, {
      macros,
      __FILENAME: fileName,
      __DIRNAME: path.resolve(path.dirname(fileName)),
      FS: fs,
      PATH: path,
      LOG: function() {
        for (var args = new Array(arguments.length + 1), i = 0, il = arguments.length; i < il; i++)
          args[i + 1] = arguments[i];

        args[0] = 'COMPILER LOG: ';
        return console.log.apply(console, argsToColor(args, 'grey'));
      },
      WARN: function() {
        for (var args = new Array(arguments.length + 1), i = 0, il = arguments.length; i < il; i++)
          args[i + 1] = arguments[i];

        args[0] = 'COMPILER WARNING: ';
        return console.log.apply(console, argsToColor(args, 'yellow'));
      },
      ERROR: function() {
        for (var args = new Array(arguments.length + 1), i = 0, il = arguments.length; i < il; i++)
          args[i + 1] = arguments[i];

        args[0] = 'COMPILER ERROR: ';
        return console.log.apply(console, argsToColor(args, 'red'));
      },
      UTILS: {
        loadJSON: (jsonPath) => {
          var contents = fs.readFileSync(jsonPath, { encoding: 'utf8' });
          return JSON.parse('' + contents);
        }
      },
      // Automatic module importer
      IMPORT_ALL: function(specifiedPath) {
        function importSorter(a, b) {
          return (a.importOrder - b.importOrder);
        }

        var baseDir = options.__DIRNAME,
            importPath = (specifiedPath) ? path.resolve(baseDir, specifiedPath) : baseDir,
            imports = fs.readdirSync(importPath).map((_fileName) => {
              var fullFileName = path.join(importPath, _fileName),
                  fileName = path.relative(baseDir, fullFileName);

              if (!fileName.match(/^(\.|\\|\/)/))
                fileName = `./${fileName}`;

              return {
                fullFileName,
                fileName
              };
            }).filter(({ fullFileName }) => fs.statSync(fullFileName).isDirectory());

        imports = imports.map(({ fullFileName, fileName }) => {
          var packageJSON;

          try {
            var packageJSONPath = path.join(fullFileName, 'package.json');
            packageJSON = require(packageJSONPath);
          } catch (e) {
            packageJSON = {};
          }

          var autoImport = packageJSON.autoImport;
          if (('' + autoImport).match(/^(false|disabled)$/)) {
            if (autoImport !== 'disabled')
              options.WARN('Not auto importing [' + fileName + '] component because autoImport=false in package.json');

            return;
          }

          var N = 'C' + options.IMPORT_INDEX;
          options.IMPORT_INDEX++;

          return Object.assign({}, {
            fileName,
            autoImport: true,
            importOrder: 999,
            importName: N,
          }, packageJSON);
        }).filter((name) => !!name).sort(importSorter);

        imports.forEach((importInfo) => {
          writeToOutput("export * from '", importInfo.fileName, "';\n");
        });
      }
    });
  };

  var template = buildRunableTemplate(fileName, source, templateOptions),
      templateOutput = template();

  if (runningDirectly) {
    debugOutput(source);
    debugOutput(templateOutput);
  }

  return templateOutput;
};
module.exports.raw = true;

const runningDirectly = (process.argv[1] === __filename);

if (runningDirectly) {
  (function () {
    var fs = require('fs'),
      inputFileName = process.argv[2];

    module.exports.call({
      getOptions: () => {
        return {
          DEV: true,
          PLATFORM: 'browser',
          PLATFORM_GENERIC: 'browser',
          MOBILE: false,
          BROWSER: true,
          ELECTRON: false,
          PROJECT_ROOT: PATHS.APP_SRC,
          APP_NAME: packageJSON.name,
          APP_VERSION: packageJSON.version
        };
      },
      getFileName: () => {
        return (inputFileName.charAt(0).match(/^(\.|\/|\\)/)) ? inputFileName : `./${inputFileName}`;
      },
      getMacros: () => []
    }, fs.readFileSync(inputFileName).toString());
  })();
}

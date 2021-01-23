/* globals Buffer */

const { memoizeModule } = require('../base-utils');

module.exports = memoizeModule(function(_globalOpts) {
  const globalOpts = _globalOpts || {},
        moment = require('moment'),
        fs = require('fs'),
        path = require('path'),
        OS = require('os'),
        stream = require('stream'),
        JSZip = require('jszip'),
        csvStringify = require('csv-stringify'),
        csvParse = require('csv-parse'),
        { Logger } = require('../logger')(globalOpts);

  class DatabaseOperations {
    // Return the first part of the filename assuming it is the model name
    static getTypeNameFromFileName(fileName) {
      return path.basename('' + fileName).replace(/^(\w+).*$/g, function(m, name) {
        return name;
      });
    }

    // Export all data from every model in the schema
    static async exportAll(database) {
      if (!database)
        throw new TypeError('"database" is a required argument to "exportAll"');

      var schema = database.getSchema();
      if (!schema)
        throw new Error('Unable to export data: no defined schema');

      // Here we generate a timestamp that will stay consistent
      // across the entire export
      var exportStartTime = moment().format('YYYY-MM-DD_HH-mm-ss'),
          models = schema.getModelSchemas(),
          modelNames = Object.keys(models || {});

      // Here we iterate every model type and export it
      var promises = modelNames.map((modelName) => {
        var modelSchema = models[modelName],
            primaryKeyField = modelSchema.getPrimaryKeyField(),
            primaryKeyFieldName = (primaryKeyField && primaryKeyField.name) || 'id';

        var query = database.query(modelName)[primaryKeyFieldName].like('*').finalize();
        return DatabaseOperations.export(database, query, exportStartTime);
      });

      // Wait for all exports to finish
      var allExports = await Promise.all(promises);

      // Create export (zip) archive name in temporary location
      var archiveName = `music-studio-export-${exportStartTime}.zip`,
          archivePath = path.join(OS.tmpdir(), archiveName);

      // Create zip archive with all exported CSVs
      return new Promise(async (resolve, reject) => {
        // This helper method will read the exported CSV and store it in our archive
        const archiveFile = (filePath) => {
          return new Promise((resolve, reject) => {
            var fileName = path.basename(filePath);
            fs.readFile(filePath, (error, data) => {
              if (error)
                return reject(error);

              // Add the file to the archive
              archive.file(fileName, data);

              // Remove the temporary exported CSV
              fs.unlinkSync(filePath);

              // Successfully resolve the operation
              resolve(fileName);
            });
          });
        };

        try {
          // Create the zip archive
          var archive = new JSZip();

          // Add all CSV exports to the zip archive
          for (var i = 0, il = allExports.length; i < il; i++) {
            var thisExport = allExports[i];
            await archiveFile(thisExport.output);
          }

          // Write the archive to disk
          archive.generateNodeStream({ type: 'nodebuffer', streamFiles: true })
            .pipe(fs.createWriteStream(archivePath))
            .on('finish', function () {
              resolve({ success: true, errors: null, output: archivePath, exports: allExports });
            });
        } catch (e) {
          var errors = (Array.isArray(e)) ? Array.prototype.concat(...e.map((thisError) => thisError.errors)) : [e];
          Logger.error('Error while exporting data: ', errors);
          reject({ success: false, errors, output: archivePath });
        }
      });

    }

    // Export a single model type (base on a query) to a CSV
    static async export(database, _query, _exportStartTime) {
      if (!database)
        throw new TypeError('"database" is a required argument to "export"');

      if (!_query)
        throw new TypeError('"query" is a required argument to "export"');

      var query = _query.finalize(),
          modelNames = query.getAllTypes();

      if (modelNames.length !== 1)
        throw new Error('"export" can only export a single model at a time');

      var modelName = modelNames[0],
          schema = database.getSchema();

      if (!schema)
        throw new Error('Unable to export data: no defined schema');

      var modelSchema = schema.getModelSchema(modelName);
      if (!modelSchema)
        throw new Error(`Unable to export data: unknown model schema "${modelName}"`);

      // Here we generate an output file name in a temporary location
      var exportStartTime = (_exportStartTime) ? _exportStartTime : moment().format('YYYY-MM-DD_HH-mm-ss'),
          outputFileName = `${modelName}-export-${exportStartTime}.csv`,
          outputPath = path.join(OS.tmpdir(), outputFileName),
          fields = modelSchema.getFields(),
          primaryKeyField = modelSchema.getPrimaryKeyField(),
          primaryKeyFieldName = (primaryKeyField && primaryKeyField.name) || 'id';

      // Write the CSV
      return new Promise(async (resolve, reject) => {
        try {
          var errors = [],
              exportedIDs = [],
              csvOut = csvStringify({
                delimiter: ',',
                columns: Object.keys(fields),
                header: true
              }),
              writeStream = fs.createWriteStream(outputPath);

          csvOut.on('error', function(error) {
            var fullError = `Export error while exporting "": ${outputPath}: ${error}`;
            Logger.error(fullError);
            errors.push(fullError);
          });

          writeStream.on('error', function(error) {
            var fullError = `Export error while exporting "": ${outputPath}: ${error}`;
            Logger.error(fullError);
            errors.push(fullError);
          });

          writeStream.on('finish', () => {
            if (errors.length)
              reject({ success: false, errors, output: outputPath, exported: exportedIDs });
            else
              resolve({ success: true, errors: null, output: outputPath, exported: exportedIDs });
          });

          csvOut.pipe(writeStream);

          var collection = (await query.all());
          await collection.forEach(async (_model) => {
            var model = await _model;
            if (!model)
              return;

            exportedIDs.push({ success: true, id: model[primaryKeyFieldName], type: 'export' });
            csvOut.write(model);
          });

          csvOut.end();
        } catch (e) {
          Logger.error(e);
          reject({ success: false, errors: [e], output: outputPath });
        }
      });
    }

    static async importAll(database, providedArchive) {
      // Here we take "providedArchive" and turn it into a readable stream
      const inputToStream = () => {
        if (providedArchive instanceof stream.Readable)
          return providedArchive;
        else if (typeof providedArchive === 'string' || (providedArchive instanceof String))
          return fs.createReadStream(providedArchive);
      };

      // This reads the readable stream into memory and get the contents
      const readInputStream = (inputStream) => {
        return new Promise((resolve, reject) => {
          var data = [];

          inputStream
            .on('error', (error) => {
              reject(error);
            })
            .on('data', function(chunk) {
              data.push(chunk);
            })
            .on('end', function() {
              resolve(Buffer.concat(data));
            });
        });
      };

      // This writes our CSV files to a temporary location
      const writeTempFile = (fileName, contents) => {
        return new Promise((resolve, reject) => {
          var fullPath = path.join(OS.tmpdir(), fileName);
          fs.writeFile(fullPath, Buffer.from(contents), (error) => {
            if (error)
              return reject(`Error importing: unable to create file ${fullPath}: ${error}`);

            resolve(fullPath);
          });
        });
      };

      if (!database)
        throw new TypeError('"database" is a required argument to "importAll"');

      return new Promise(async (resolve, reject) => {
        // This runs "import" on each file asynchronously (in parallel)
        const importFile = (promise, fileName, typeName) => {
          return promise.then(async (fullFileName) => {
            return DatabaseOperations.import(database, fullFileName, { name: fileName, typeName });
          }, (error) => {
            errors.push(error);
          });
        };

        var errors = [];

        try {
          // Read archive data into memory and create zip archive interface
          var data = await readInputStream(inputToStream()),
              archive = await JSZip.loadAsync(data),
              fileNames = [],
              promises = [];

          // Iterate all files inside the zip archive
          archive.forEach((relativePath, zipEntry) => {
            if (zipEntry.dir)
              return;

            // If the file isn't a CSV than skip it
            var fileName = zipEntry.name;
            if (!fileName.match(/\.csv$/i))
              return;

            // Get the data type from the filename
            var typeName = DatabaseOperations.getTypeNameFromFileName(fileName);
            if (!typeName) {
              errors.push(`Error importing ${fileName}, unknown data type`);
              return;
            }

            // Add to our list of files to import
            fileNames.push({ typeName, fileName });
          });

          // Iterate all filtered files from the zip archive and start importing them (in parallel)
          for (var i = 0, il = fileNames.length; i < il; i++) {
            var file = fileNames[i],
                fileName = file.fileName,
                typeName = file.typeName,
                // Here we create a random file name to dump in our temporary location
                // we make it super random to avoid possible collisions
                randomImportFileName = `${typeName}-${moment().valueOf()}${Math.round((Math.random() * 999999))}.csv`,
                // Read file contents from zip archive
                contents = await (archive.file(fileName).async("uint8array"));

            // Write the file to a temporary location
            var promise = writeTempFile(randomImportFileName, contents);

            // Import the file (once it has finished writing)
            promises.push(importFile(promise, fileName, typeName));
          }

          // Collect results from all imports
          var results = await Promise.all(promises);
          resolve({ success: true, errors: null, imports: results });
        } catch (e) {
          var errors = (Array.isArray(e)) ? Array.prototype.concat(...e.map((thisError) => thisError.errors)) : [e];
          Logger.error('Error while exporting data: ', errors);
          reject({ success: false, errors, imports: [] });
        }
      });
    }

    static async import(database, csv, _opts) {
      // Turns any string (or buffer) into a readable stream
      const createStringStream = (_contents) => {
        var contents = _contents;

        if (contents instanceof Uint8Array)
          contents = Buffer.from(contents).toString('utf8');
        if (contents instanceof Buffer)
          contents = contents.toString('utf8');

        var stringStream = new stream.Readable();
        stringStream._read = () => {}; // noop
        stringStream.push(contents);
        stringStream.push(null);

        return stringStream;
      };

      // This creates a "write" stream that will receive
      // the CSV lines (records) and write them to the database
      const createRecordWriterStream = (cb) => {
        var writerStream = new stream.Writable({
          objectMode: true
        });

        writerStream._write = function (chunk, enc, next) {
          // "chunk" here is the full CSV line formatted into a record object
          // call our callback with this record
          cb(chunk, next);
        };

        return writerStream;
      };

      // Convert what the user gave us to a usable stream
      const inputToStream = () => {
        if (csv instanceof stream.Readable) {
          return csv;
        } else if (typeof csv === 'string' || isRaw) {
          // is this a raw string stream or a fileName?
          if (isRaw)
            return createStringStream(csv);
          else
            return fs.createReadStream(csv);
        }
      };

      // Get the data type to import
      // if this is not defined in opts.typeName
      // try to guess it from the fileName
      const getTypeName = () => {
        if (opts.typeName)
          return opts.typeName;

        if (csv instanceof stream.Readable) {
          throw new TypeError('"typeName" is a required option when import is provided a stream');
        } else if (typeof csv === 'string' || isRaw) {
          // is this a raw string stream or a fileName?
          if (isRaw) {
            throw new TypeError('"typeName" is a required option when import is provided raw content');
          } else {
            fileName = csv;
            // Return the first part of the filename assuming it is the model name
            return DatabaseOperations.getTypeNameFromFileName(csv);
          }
        }
      };

      if (!database)
        throw new TypeError('"database" is a required argument to "import"');

      var opts = _opts || {},
          fileName,
          typeName = getTypeName(),
          isRaw = opts.raw || (csv instanceof Buffer) || (csv instanceof Uint8Array),
          schema = database.getSchema();

      if (!schema)
        throw new Error('Unable to import data: no defined schema');

      var modelSchema = schema.getModelSchema(typeName),
          ModelClass = schema.getModelClass(typeName);

      if (!modelSchema || !ModelClass)
        throw new Error('Unable to import data: no defined model schema');

      // Read the CSV
      return new Promise(async (resolve, reject) => {
        var importedIDs = [];

        try {
          // Create CSV parser
          var csvIn = csvParse({
                delimiter: ',',
                columns: true,
                trim: true,
                skip_empty_lines: true,
                // This is a column formatter
                cast: (_value, context) => {
                  var value = _value;
                  if (context.header)
                    return value;

                  // Is it quoted? If so, strip the quotes
                  if (context.quoting)
                    value = value.replace(/^["]/, '').replace(/["]$/, '');

                  // If it is empty just return null
                  if (value == null || value == '')
                    return null;

                  // Is it a parsable number?
                  if (value.match(/^[-+]?[\de.]+$/)) {
                    var num = parseFloat(value);
                    if (!isNaN(num) && isFinite(num))
                      return num;
                  }

                  // Is it a boolean?
                  if (value.toLowerCase() === 'true')
                    return true;
                  else if (value.toLowerCase() === 'false')
                    return false;

                  // Just return it as-is
                  return value;
                }
              }),
              errors = [];

          // Create CSV writer strea (to read records/lines real-time and write to the database)
          var recordWriter = createRecordWriterStream(async (record, next) => {
                try {
                  // If we get an array then the csv parser doesn't have columns
                  // to map to... which means we have big issues
                  if (Array.isArray(record))
                    throw new TypeError('Error while importing: unexpected input... did you forget a column header?');

                  // Create the model from the data and validate it
                  var model = new ModelClass(record),
                      errors = model.validate();

                  // If we have validation errors throw an error
                  if (errors)
                    throw new Error(`Errors while importing: ${errors.join(', ')}`);

                  // Store the model in the database
                  var result = await database.store(model, { allowUpdate: true });
                  importedIDs = importedIDs.concat(result);

                  next(null, record);
                } catch (e) {
                  next(e, record);
                }
              });

          csvIn.on('error', (error) => {
            Logger.error(error);
            errors.push(error);
          });

          recordWriter.on('error', (error) => {
            Logger.error(error);
            errors.push(error);
          });

          recordWriter.on('finish', function() {
            // If there were errors then fail, otherwise succeed
            if (errors.length)
              reject({ name: opts.name || fileName, typeName, success: false, errors, imported: importedIDs });
            else
              resolve({ name: opts.name || fileName, typeName, success: true, errors: null, imported: importedIDs });
          });

          // Read the input stream, pipe it through the CSV parser, and finally pipe it to our record writer
          inputToStream().pipe(csvIn).pipe(recordWriter);
        } catch (e) {
          Logger.error('Error while importing: ', e);
          reject({ name: opts.name || fileName, typeName, success: false, errors: [e], imported: importedIDs });
        }
      });
    }
  }

  return {
    DatabaseOperations
  };
});


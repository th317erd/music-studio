'use strict';

function resolvePath(...parts) {
  var resolvedPath = PATH.resolve(...parts);

  try {
    return FS.realpathSync(resolvedPath);
  } catch (e) {
    return resolvedPath;
  }
}

function ensureSlash(path, needsSlash) {
  const hasSlash = path.endsWith('/');

  if (hasSlash && !needsSlash)
    return path.substr(path, path.length - 1);
  else if (!hasSlash && needsSlash)
    return `${path}/`;
  else
    return path;
}

const PATH = require('path'),
      FS = require('fs'),
      URL = require('url');

// Make sure any symlinks in the project folder are resolved:
// https://github.com/facebookincubator/create-react-app/issues/637
const rootDirectory = resolvePath(__dirname, '..', '..'),
      appDirectory = resolvePath(rootDirectory, 'client');

const resolveApp = (relativePath) => resolvePath(rootDirectory, relativePath);
const resolveClient = (relativePath) => resolvePath(appDirectory, relativePath);

const envPublicUrl = process.env.PUBLIC_URL;

const getPublicUrl = (appPackageJson) => (envPublicUrl || require(appPackageJson).homepage);

// We use `PUBLIC_URL` environment variable or "homepage" field to infer
// "public PATH" at which the app is served.
// Webpack needs to know it to put the right <script> hrefs into HTML even in
// single-page apps that may serve index.html for nested URLs like /todos/42.
// We can't use a relative PATH in HTML because we don't want to load something
// like /todos/42/static/js/bundle.7289d.js. We have to know the root.
function getServedPath(appPackageJson) {
  const publicUrl = getPublicUrl(appPackageJson),
        servedUrl =
        envPublicUrl || ((publicUrl) ? URL.parse(publicUrl).pathname : '/');

  return ensureSlash(servedUrl, true);
}

// config after eject: we're in ./config/
module.exports = {
  resolvePath,
  PROJECT_ROOT: rootDirectory,
  REACT_AMELIORATE: resolvePath(rootDirectory, '..', 'react-ameliorate'),
  APP_ROOT: appDirectory,
  APP_BUILD: resolveClient('build'),
  APP_PUBLIC: resolveClient('public'),
  APP_STAND_ALONE: resolveClient('stand-alone'),
  APP_STAND_ALONE_BUNDLE: resolveClient('stand-alone/js/bundle.js'),
  APP_TEST_BUNDLE: resolveApp('spec'),
  APP_INDEX: resolveClient('source/index.js'),
  FFMPEG_INDEX: resolveClient('source/ffmpeg-worker.js'),
  APP_MAIN: resolveClient('source/application.js'),
  APP_PACKAGE: resolveApp('package.json'),
  APP_SRC: resolveClient('source'),
  APP_MODULES: resolveApp('node_modules'),
  PUBLIC_URL: getPublicUrl(resolveApp('package.json')),
  SERVED_PATH: getServedPath(resolveApp('package.json')),
};

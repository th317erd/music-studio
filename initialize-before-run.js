#!/bin/env node

const fs = require('fs'),
      path = require('path'),
      developerSessionFile = path.resolve(__dirname, 'client/source/developer-session.js'),
      developerSessionTemplateFile = path.resolve(__dirname, 'client/source/developer-session-template.js');

if (!fs.existsSync(developerSessionFile))
  fs.copyFileSync(developerSessionTemplateFile, developerSessionFile);

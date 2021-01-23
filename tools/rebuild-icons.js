var FileSystem  = require('fs'),
    Path        = require('path'),
    spawnSync   = require('child_process').spawnSync;

const FONT_TYPES_PATH = require.resolve('../client/source/icons/music-studio-icon-map.json'),
      FONT_SOURCE_PATH = require.resolve('../client/assets/font/source/music-studio-font.json'),
      FONT_DESTINATION_PATH = require.resolve('../client/source/fonts/music-studio-icons-b64.js'),
      MASTER_SVG_PATH = Path.join(Path.dirname(FONT_SOURCE_PATH), 'master.svg'),
      ICONS_PER_ROW = 10,
      GLYPH_NAME_MAP = {
        "ok": "check",
        "circle": "round-check"
      };

var fontTypes       = require(FONT_TYPES_PATH),
    musicStudioFont = require(FONT_SOURCE_PATH);

function getIconName(glyph) {
  if (!glyph)
    return;

  var name = glyph.css || glyph;
  if (GLYPH_NAME_MAP.hasOwnProperty(name))
    return GLYPH_NAME_MAP[name];

  return name;
}

function syncFontSourceWithFontTypes() {
  var glyphs = musicStudioFont.glyphs || [],
      keys = Object.keys(fontTypes);

  for (var j = 0, jl = keys.length; j < jl; j++) {
    var fontKey = keys[j],
        fontCode = fontTypes[fontKey].toUpperCase();

    for (var i = 0, found = false, il = glyphs.length; i < il; i++) {
      var glyph = glyphs[i],
          hexCode = parseInt(('' + glyph.code).replace(/D/g, '')).toString(16).toUpperCase();

      if (hexCode !== fontCode)
        continue;

      found = true;
      glyph.css = getIconName(fontKey);
    }

    if (!found)
      console.warn("Couldn't find named glyph: ", fontKey);
  }

  //console.log(musicStudioFont);
  FileSystem.writeFileSync(FONT_SOURCE_PATH, JSON.stringify(musicStudioFont, undefined, 2));
}

function syncFontSourceToMasterSVG() {
  var glyphs = musicStudioFont.glyphs || [],
      maxWidth = 0,
      x = 0,
      y = 0,
      index = 0;

  glyphs.forEach((glyph) => {
    var w = (glyph && glyph.svg) ? parseInt(('' + glyph.svg.width), 10) : 0;
    if (w > maxWidth)
      maxWidth = w;
  });

  var paths = glyphs.map((glyph) => {
    if (!glyph || !glyph.svg)
      return;

    var hexCode = parseInt(('' + glyph.code).replace(/D/g, '')).toString(16).toUpperCase(),
        name = getIconName(glyph),
        svg = glyph.svg,
        width = parseInt(('' + svg.width), 10),
        row = Math.floor(index / ICONS_PER_ROW),
        col = index % ICONS_PER_ROW,
        offset = (maxWidth - width) / 2,
        y = (row * maxWidth) + offset,
        x = (col * maxWidth) + offset;

    index++;

    return `<path id="${hexCode}" class="${name}" d="${svg.path}" transform="translate(${x},${y})"/>`;
  }).filter((g) => !!g);

  var totalHeight = (Math.floor(paths.length / ICONS_PER_ROW) + 1) * maxWidth,
      totalWidth = ICONS_PER_ROW * maxWidth;

  FileSystem.writeFileSync(MASTER_SVG_PATH, `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${totalHeight}" viewBox="0 0 ${totalWidth} ${totalHeight}">\n  ${paths.join('\n  ')}\n</svg>`);
}

function extractFontelloArchive(archiveName) {
  var fullPathToArchive = Path.resolve(archiveName);

  var result = spawnSync('unzip ', [
    '-o',
    fullPathToArchive,
    '-d',
    '/tmp/'
  ], {
    env: process.env,
    shell: true
  });

  if (result.error)
    throw result.error;

  return result.stdout.toString();
}

function rebuildFontPackFromFontelloArchive(archiveName) {
  var configJSONName,
      ttfName,
      result = extractFontelloArchive(archiveName);

  // Get information from extraction on where files are located
  result.replace(/\/tmp\/.*(config\.json|.*ttf)\s*$/gim, function(m) {
    if (m.match(/config\.json/i))
      configJSONName = m.trim();
    else
      ttfName = m.trim();
  });

  // Pull files from extracted archive data
  var configJSON = require(configJSONName),
      ttfFontBase64 = new Buffer(FileSystem.readFileSync(ttfName)).toString('base64');

  // Update ttf inside fonts.js source
  FileSystem.writeFileSync(FONT_DESTINATION_PATH, 'module.exports = ' + JSON.stringify({
    name: 'music-studio',
    type: 'ttf',
    data: ttfFontBase64
  }, undefined, 2) + ';\n');

  // Dump font-types.js data
  var fontTypesObj = {},
      glyphs = configJSON.glyphs || [];

  for (var i = 0, il = glyphs.length; i < il; i++) {
    var glyph = glyphs[i],
        hexCode = parseInt(('' + glyph.code).replace(/D/g, '')).toString(16).toUpperCase();

    fontTypesObj[getIconName(glyph)] = hexCode;
  }

  var fontTypesFileContents = JSON.stringify(fontTypesObj, undefined, 2);
  FileSystem.writeFileSync(FONT_TYPES_PATH, fontTypesFileContents);

  // Update font source
  FileSystem.writeFileSync(FONT_SOURCE_PATH, JSON.stringify(configJSON, undefined, 2));

  console.log('Font pack updated successfully with ' + glyphs.length + ' total glyphs');
}

if (!process.argv[2]) {
  console.log('Usage npm run rebuild-icons -- /path/to/fontello/archive.zip');
  process.exit(0);
}

var archiveName = process.argv[2];
rebuildFontPackFromFontelloArchive(archiveName);
//syncFontSourceWithFontTypes();
syncFontSourceToMasterSVG();

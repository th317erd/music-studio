// This is needed as a shim for browser code

function addStyleString(str) {
  var node = document.createElement('style');
  node.innerHTML = str;
  document.head.appendChild(node);
}

function doLoadFont(name, data, _type) {
  var type = (!_type || _type === 'ttf') ? 'font/ttf' : 'font/opentype',
      fontCSS = ['@font-face { font-family:\'', name, '\'; font-style: normal; font-weight: 200; src: url(\'data:', type, ';base64,', data, '\');}'].join('');

  addStyleString(fontCSS);
}

export async function loadFont(name, data, _type) {
  doLoadFont(name, data, _type);
}

export async function loadFonts(_fonts) {
  var fonts = (Array.isArray(_fonts)) ? _fonts : [_fonts];
  for (var i = 0, il = fonts.length; i < il; i++) {
    var font = fonts[i];
    doLoadFont(font.name, font.data, font.type);
  }
}

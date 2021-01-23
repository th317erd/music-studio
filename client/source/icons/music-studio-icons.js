import fontIconMap from './music-studio-icon-map.json';

const glyphMap = Object.keys(fontIconMap).reduce((map, key) => {
        map[key] = String.fromCharCode(parseInt(fontIconMap[key], 16));
        return map;
      }, {}),
      iconGlyphMap = {
        'music-studio': glyphMap
      };

export default iconGlyphMap;

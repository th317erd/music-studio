import { data as D }          from 'evisit-js-utils';
import {
  Color,
  Theme as _Theme,
  ThemeProperties as _ThemeProperties,
  StyleSheetBuilder as _StyleSheetBuilder,
  PLATFORM
}                             from '@react-ameliorate-base/styles';
import { copyStaticMethods }  from './utils';

// -------------- StyleSheetBuilder -------------- //

// Overload StyleSheetBuilder
const StyleSheetBuilder = copyStaticMethods(class StyleSheetBuilder extends _StyleSheetBuilder {
  // Wrap createStyleSheet to use our overloaded StyleSheetBuilder class (if no other class is specified)
  static createStyleSheet(factory, _opts) {
    var opts = Object.assign({ StyleSheetBuilder }, _opts || {});
    return _StyleSheetBuilder.createStyleSheet(factory, opts);
  }
});

const createStyleSheet = StyleSheetBuilder.createStyleSheet;

const ThemeProperties = copyStaticMethods(class ThemeProperties extends _ThemeProperties {
  constructor(themeProps, parentTheme) {
    super(D.extend(true, {}, themeProps, {
      PALETTE: {
        GREY01: '#E6E6E6',
        GREY02: '#C8C8C8',
        GREY03: '#ABABAB',
        GREY04: '#8E8E8E',
        GREY05: '#717171',
        GREY06: '#545454',
        GREY07: '#373737'
      }
    }), parentTheme);
  }

  getThemeProps(themeProps, paletteProps) {
    const palette = paletteProps.palette,
          DEFAULT_PADDING = 30;

    return super.getThemeProps(Object.assign({
      DEFAULT_PADDING,
      DEFAULT_CONTENT_PADDING: Math.round(DEFAULT_PADDING * 0.5),
      DEFAULT_CONTROL_PADDING: Math.round(DEFAULT_PADDING * 0.25),
      DEFAULT_INPUT_HEIGHT: 40,
      DEFAULT_RADIUS: 4,
      FONT_SIZE_MEDIUM: 16,
      FONT_SIZE_LARGE: 20,
      DEFAULT_ANIMATION_DURATION: 200,
      DEFAULT_HOVER_OPACITY: 0.2
    }, themeProps || {}), paletteProps);
  }
});

const Theme = copyStaticMethods(class Theme extends _Theme {
  constructor(themeProps, _opts) {
    var opts = Object.assign({
      platform: PLATFORM,
      ThemePropertiesClass: ThemeProperties
    }, _opts || {});

    super(themeProps, opts);
  }
});

export {
  StyleSheetBuilder,
  ThemeProperties,
  Theme,
  Color,
  createStyleSheet,
  PLATFORM
};

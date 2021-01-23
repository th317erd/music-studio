import { createStyleSheet }   from '@base';
import { selectFieldStyles }  from '@react-ameliorate/component-select-field';
import { textFieldStyles }    from '@react-ameliorate/component-text-field';
import { insertStyleSheet }   from './base/utils';

export default createStyleSheet(function(theme, selectFieldStyles, textFieldStyles) {
  const TOOLTIP_DISTANCE = theme.DEFAULT_PADDING * 0.5;

  const getTransforms = (...args) => {
    return args.map((arg) => `${arg} ${theme.DEFAULT_ANIMATION_DURATION}ms cubic-bezier(0.4, 0, 0.2, 1) 0ms`).join(', ');
  };

  var styles = {
    'body, html, #root': {
      fontFamily: 'sans-serif',
      padding: 0,
      margin: 0,
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      overflow: 'hidden',
      borderWidth: 0,
      borderStyle: 'solid',
      fontSize: theme.FONT_SIZE_SMALL,
      _WebkitFontSmoothing: 'auto'
    },

    '*': {
      margin: 0,
      padding: 0,
      border: 0,
      verticalAlign: 'top',
      boxSizing: 'border-box'
    },

    '*:focus': {
      outline: 'none'
    },

    'div,ul,li': {
      borderWidth: 0,
      borderStyle: 'solid',
      position: 'relative',
      display: 'flex',
      boxSizing: 'border-box',
      flexDirection: 'column',
    },

    'span': {
      display: 'inline-block',
      flex: '0 1 auto'
    },

    '#root': {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'stretch',
      justifyContent: 'flex-start',
      fontSize: theme.FONT_SIZE_MEDIUM
    },

    '.application-hide': {
      display: 'none !important'
    },

    'div,ul,li': {
      borderWidth: 0,
      borderStyle: 'solid',
      position: 'relative',
      display: 'flex',
      boxSizing: 'border-box',
      flexDirection: 'column',
    },

    'span': {
      display: 'inline-block',
      flex: '0 1 auto'
    },

    '#root .applicationSelectFieldOption': {
      transition: `color ${theme.DEFAULT_ANIMATION_DURATION}ms, background-color ${theme.DEFAULT_ANIMATION_DURATION}ms`
    },

    '#root [tooltip]:not([tooltip=\'\'])::before': {
      pointerEvents: 'none',
      userSelect: 'none',
      transition: `opacity ${theme.DEFAULT_ANIMATION_DURATION}ms 1000ms`,
      opacity: 0,
      display: 'inline-block',
      position: 'absolute',
      left: '50%',
      top: '100%',
      whiteSpace: 'nowrap',
      fontSize: theme.FONT_SIZE_XTINY,
      transform: 'translate(-50%, 0)',
      content: 'attr(tooltip)',
      color: theme.textColor(theme.CHART_TOOLTIP_COLOR),
      backgroundColor: theme.CHART_TOOLTIP_COLOR,
      borderRadius: theme.DEFAULT_RADIUS,
      padding: theme.DEFAULT_PADDING * 0.25,
      zIndex: 500
    },

    '#root [tooltip][tooltip-side="bottom"]:not([tooltip=\'\'])::before': {
      left: '50%',
      top: '100%',
      transform: 'translate(-50%, 0)',
      marginTop: TOOLTIP_DISTANCE
    },

    '#root [tooltip][tooltip-side="top"]:not([tooltip=\'\'])::before': {
      left: '50%',
      top: '0%',
      transform: 'translate(-50%, -100%)',
      marginTop: -TOOLTIP_DISTANCE
    },

    '#root [tooltip][tooltip-side="left"]:not([tooltip=\'\'])::before': {
      left: '0%',
      top: '50%',
      transform: 'translate(-100%, -50%)',
      marginLeft: -TOOLTIP_DISTANCE
    },

    '#root [tooltip][tooltip-side="right"]:not([tooltip=\'\'])::before': {
      left: '100%',
      top: '50%',
      transform: 'translate(0, -50%)',
      marginLeft: TOOLTIP_DISTANCE
    },

    '#root [tooltip]:not([tooltip=\'\'])::after': {
      pointerEvents: 'none',
      userSelect: 'none',
      transition: `opacity ${theme.DEFAULT_ANIMATION_DURATION}ms 1000ms`,
      opacity: 0,
      boxSizing: 'border-box',
      width: 15,
      height: 15,
      display: 'inline-block',
      position: 'absolute',
      bottom: -TOOLTIP_DISTANCE,
      whiteSpace: 'nowrap',
      fontSize: theme.FONT_SIZE_XTINY,
      content: '" "',
      backgroundColor: 'transparent',
      borderWidth: 7,
      borderColor: theme.CHART_TOOLTIP_COLOR,
      borderStyle: 'solid',
      zIndex: 500
    },

    '#root [tooltip][tooltip-side="bottom"]:not([tooltip=\'\'])::after': {
      borderTopColor: 'transparent',
      borderLeftColor: 'transparent',
      borderRightColor: 'transparent',
      transform: 'translate(-50%, 100%)',
      left: '50%',
      bottom: 0
    },

    '#root [tooltip][tooltip-side="left"]:not([tooltip=\'\'])::after': {
      borderTopColor: 'transparent',
      borderBottomColor: 'transparent',
      borderRightColor: 'transparent',
      transform: 'translate(-100%, -50%)',
      left: '0%',
      top: '50%'
    },

    '#root [tooltip][tooltip-side="right"]:not([tooltip=\'\'])::after': {
      borderTopColor: 'transparent',
      borderBottomColor: 'transparent',
      borderLeftColor: 'transparent',
      transform: 'translate(0, -50%)',
      left: '100%',
      top: '50%'
    },

    '#root [tooltip][tooltip-side="top"]:not([tooltip=\'\'])::after': {
      borderBottomColor: 'transparent',
      borderLeftColor: 'transparent',
      borderRightColor: 'transparent',
      transform: 'translate(-50%, -100%)',
      left: '50%',
      top: 0
    },

    // Main tooltip hover state
    '#root [tooltip]:not([tooltip=\'\']):not(.applicationFieldFocus):hover::before': {
      opacity: 1
    },

    // Tooltip arrow hover states
    '#root [tooltip][tooltip-side="bottom"]:not([tooltip=\'\']):not(.applicationFieldFocus):hover::after': {
      opacity: 1
    },

    '#root [tooltip][tooltip-side="left"]:not([tooltip=\'\']):not(.applicationFieldFocus):hover::after': {
      opacity: 1
    },

    '#root [tooltip][tooltip-side="right"]:not([tooltip=\'\']):not(.applicationFieldFocus):hover::after': {
      opacity: 1
    },

    '#root [tooltip][tooltip-side="top"]:not([tooltip=\'\']):not(.applicationFieldFocus):hover::after': {
      opacity: 1
    },

    '#root .applicationTextField input::placeholder': {
      color: 'transparent !important'
    },

    '#root .applicationField.applicationFieldError .applicationTextField label': {
      color: theme.ERROR_COLOR
    },

    '#root .applicationTextField label': {
      color: theme.textColor(theme.contrastColor(theme.MAIN_COLOR), 6),
      position: 'relative',
      fontSize: theme.DEFAULT_FONT_SIZE,
      transition: `all ${theme.DEFAULT_ANIMATION_DURATION}ms`,
      overflow: 'hidden',
      browser: {
        pointerEvents: 'none',
        textOverflow: 'ellipsis',
        whiteSpace: 'pre-line'
      }
    },

    '#root .applicationTextField[data-label-side="floating"] label': {
      position: 'absolute',
      top: '50%',
      left: textFieldStyles.FIELD_SIDE_PADDING,
      right: textFieldStyles.FIELD_SIDE_PADDING,
      overflow: 'hidden',
      whiteSpace: 'nowrap',
      transform: 'translate(0, -50%)',
      width: '100%',
      marginTop: textFieldStyles.FIELD_SIDE_PADDING * 0.5,
      browser: {
        textOverflow: 'ellipsis'
      }

      //paddingTop: textFieldStyles.FIELD_SIDE_PADDING
    },

    '#root .applicationTextField input:not([value=""]) + label': {
      top: 0,
      transform: 'translate(0, -10%)',
      fontSize: theme.DEFAULT_FONT_SIZE * 0.625,
      browser: {
        whiteSpace: 'normal'
      }
    }
  };

  console.log('Application styles: ', styles);

  return styles;
}, {
  resolveStyles: [ selectFieldStyles, textFieldStyles ],
  onUpdate: function(styleSheet) {
    const getStyleSheetContent = () => {
      var generateStyles = [],
          keys = Object.keys(styleSheet);

      for (var i = 0, il = keys.length; i < il; i++) {
        var key = keys[i],
            style = styleSheet[key];

        // Skip constants (upper-case keys)
        if (key.match(/^[A-Z]/))
          continue;

        generateStyles.push({
          selector: key,
          style
        });
      }

      return this.buildCSSFromStyles(generateStyles);
    };

    insertStyleSheet('mainApplicationStyleSheet', getStyleSheetContent());

    return {};
  }
});

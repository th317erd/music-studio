import { createStyleSheet } from '@base';

export default createStyleSheet(function(theme) {
  return {
    controlRow: {
      alignItems: 'center'
    },
    buttonContainer: {
      width: Math.round(theme.DEFAULT_FONT_SIZE * 10)
    },
    fileInput: {
      position: 'absolute',
      width: '100%',
      height: '100%',
      opacity: 0,
      browser: {
        cursor: 'pointer'
      }
    }
  };
});

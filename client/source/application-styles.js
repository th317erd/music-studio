import { createStyleSheet } from '@base';

export default createStyleSheet(function(theme) {
  return {
    container: {
      flex: 1
    },
    containerNotReady: {
      alignItems: 'center',
      justifyContent: 'center'
    },
    overlayContainer: {
      flex: 1
    }
  };
});

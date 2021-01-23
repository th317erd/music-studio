import { createStyleSheet } from '@base';

export default createStyleSheet(function(theme) {
  return {
    container: {
      flex: 1,
      flexDirection: 'column',
      alignItems: 'stretch',
      justifyContent: 'flex-start',
      paddingTop: theme.DEFAULT_PADDING,
      paddingBottom: theme.DEFAULT_PADDING
    },
    mainContextRootStyle: {

    },
    pageContainerStyle: {
      flex: 1,
      alignSelf: 'stretch',
      justifyContent: 'flex-start'
    },
    pageContentContainer: {
      flex: 1
    }
  };
});

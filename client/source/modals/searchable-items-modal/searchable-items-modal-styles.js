import { createStyleSheet }   from '@base';
import { genericModalStyles } from '@react-ameliorate/component-generic-modal';

export default createStyleSheet(function(theme) {
  return {
    contentContainer: {
      paddingLeft: theme.DEFAULT_PADDING * 0.5,
      paddingRight: theme.DEFAULT_PADDING * 0.5,
      alignItems: 'stretch',
      justifyContent: 'flex-start'
    }
  };
}, {
  mergeStyles: genericModalStyles
});

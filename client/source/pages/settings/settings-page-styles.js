import { createStyleSheet } from '@base';
import basePageStyle        from '../base-page/base-page-styles';

export default createStyleSheet(function(theme) {
  return {
    pageContainerStyle: {
      paddingLeft: theme.DEFAULT_PADDING,
      paddingRight: theme.DEFAULT_PADDING
    },
    captionedGroup: {
      maxWidth: 400
    },
    form: {

    }
  };
}, {
  mergeStyles: [basePageStyle]
});

import { createStyleSheet } from '@base';
import basePageStyle        from '../base-page/base-page-styles';

export default createStyleSheet(function(theme) {
  return {
    pageContainerStyle: {
      alignItems: 'center'
    }
  };
}, {
  mergeStyles: [basePageStyle]
});

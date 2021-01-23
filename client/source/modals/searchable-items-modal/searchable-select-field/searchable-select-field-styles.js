import { createStyleSheet }   from '@base';
import { selectFieldStyles }  from '@react-ameliorate/component-select-field';

export default createStyleSheet(function(theme, selectFieldStyles) {
  return {
    optionsListContainer: {
      height: selectFieldStyles.DEFAULT_OPTION_HEIGHT * 5
    },
    buttonContainer: {
      paddingTop: theme.DEFAULT_CONTROL_PADDING
    }
  };
}, {
  mergeStyles: selectFieldStyles
});

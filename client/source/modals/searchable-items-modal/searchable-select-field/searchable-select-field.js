import React                            from 'react';
import { componentFactory, PropTypes }  from '@base';
import { ScrollView }                   from '@react-ameliorate/native-shims';
import { Button }                       from '@react-ameliorate/component-button';
import { LayoutContainer }              from '@react-ameliorate/component-layout-container';
import { SelectField }                  from '@react-ameliorate/component-select-field';
import styleSheet                       from './searchable-select-field-styles';

export const SearchableSelectField = componentFactory('SearchableSelectField', ({ Parent, componentName }) => {
  return class SearchableItemsModal extends Parent {
    static styleSheet = styleSheet;

    static propTypes = {
      onSelect: PropTypes.func,
      selectButtonCaption: PropTypes.string
    };

    resolveProps() {
      return {
        ...super.resolveProps.apply(this, arguments),
        renderOptionsInline: true,
        optionsAlwaysVisible: true
      };
    }

    onOptionSelect() {
      var value = super.onOptionSelect.apply(this, arguments);
      console.log('OPTION SELECTED!', value);
    }

    onSelect(args) {
      var option = this.value();
      this.callProvidedCallback('onSelect', { ...args, option });
    }

    renderIcon() {
      return null;
    }

    renderOptions() {
      return (
        <ScrollView
          className={this.getRootClassName(componentName)}
          style={this.style('optionsListContainer')}
        >
          {this.renderAllOptions()}
        </ScrollView>
      );
    }

    render() {
      var spacing = this.styleProp('DEFAULT_CONTROL_PADDING'),
          value = this.value(),
          hasValue = !!value;

      return super.render(
        <LayoutContainer
          direction="vertical"
          spacing={spacing}
          style={this.style('buttonContainer')}
        >
          <Button
            caption={(this.props.selectButtonCaption) ? this.props.selectButtonCaption : 'Select Item'}
            onPress={this.onSelect}
            disabled={!hasValue}
          />
        </LayoutContainer>
      );
    }
  };
}, SelectField);

import React                            from 'react';
import { componentFactory, PropTypes }  from '@base';
import { GenericModal }                 from '@react-ameliorate/component-generic-modal';
import { Field }                        from '@react-ameliorate/component-field';
import { SearchableSelectField }        from './searchable-select-field';
import styleSheet                       from './searchable-items-modal-styles';

const SearchableItemsModal = componentFactory('SearchableItemsModal', ({ Parent, componentName }) => {
  return class SearchableItemsModal extends Parent {
    static styleSheet = styleSheet;

    static propTypes = {
      options: Field.propTypes.options,
      getOptionCaption: Field.propTypes.getOptionCaption,
      caption: PropTypes.string,
      selectButtonCaption: PropTypes.string,
      onSelect: PropTypes.func
    };

    resolveState() {
      return {
        ...super.resolveState.apply(this, arguments),
        ...this.getState({
        })
      };
    }

    onSelect(args) {
      if (this.callProvidedCallback('onSelect', args) === false)
        return false;

      this.requestClose();
    }

    render(_children) {
      return super.render(
        <SearchableSelectField
          caption={this.props.caption}
          selectButtonCaption={this.props.selectButtonCaption}
          options={this.props.options}
          getOptionCaption={this.props.getOptionCaption}
          onSelect={this.onSelect}
        />
      );
    }
  };
}, GenericModal);

export { SearchableItemsModal };

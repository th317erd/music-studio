import {
  React,
  componentFactory
}                           from '@base';
import {
  View,
  SettingsControls
}                           from '@components';
import { BasePage }         from '../base-page';
import styleSheet           from './settings-page-styles';

const SettingsPage = componentFactory('SettingsPage', ({ Parent, componentName }) => {
  return class SettingsPage extends Parent {
    static styleSheet = styleSheet;

    static pageInfo() {
      return {
        icon: 'cog',
        caption: this.langTerm('settings'),
        order: 50
      };
    }

    render() {
      return super.render(
        <View className={this.getRootClassName(componentName)} style={this.style('pageContainerStyle')} layoutContext="main">
          <SettingsControls style={this.style('captionedGroup')}/>
        </View>
      );
    }
  };
}, BasePage);

export { SettingsPage };

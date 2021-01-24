import {
  React,
  componentFactory
}                           from '@base';
import {
  Button,
  View
}                           from '@components';
import { BasePage }         from '../base-page';
import styleSheet           from './home-page-styles';

const HomePage = componentFactory('HomePage', ({ Parent, componentName }) => {
  return class HomePage extends Parent {
    static styleSheet = styleSheet;

    static pageInfo() {
      return {
        icon: 'home',
        caption: this.langTerm('home'),
        order: 10
      };
    }

    generateSound() {

    }

    render() {
      return super.render(
        <View className={this.getRootClassName(componentName)} style={this.style('pageContainerStyle')} layoutContext="main">
          <View style={{ width: 300 }}>
            <Button
              caption="Generate sound"
              onPress={this.generateSound}
              tooltip="Generate and play a sound"
              tooltipSide="top"
            />
          </View>
        </View>
      );
    }
  };
}, BasePage);

export { HomePage };

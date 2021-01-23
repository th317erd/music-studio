import {
  React,
  componentFactory
}                           from '@base';
import { utils as U }       from 'evisit-js-utils';
import {
  Button,
  View,
  Text,
  TextField,
  SelectField,
  AlertModal,
  ConfirmModal
}                           from '@components';
import { BasePage }         from '../base-page';
import styleSheet           from './home-page-styles';

const options = {
  test1: 'Derp 1',
  test2: 'Derp 2',
  test3: 'Derp 3'
};

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

    async fetchOptions(searchTerm) {
      if (U.noe(searchTerm))
        return [];

      return this.delay(() => {
        return options;
      }, 1500);
    }

    render() {
      return super.render(
        <View className={this.getRootClassName(componentName)} style={this.style('pageContainerStyle')} layoutContext="main">
          <View style={{ width: 300 }}>
            <Text>Home page content goes here...</Text>

            <Button
              caption="I am a button!"
              onPress={() => {
                this.getApp(({ app }) => {
                  app.pushModal(
                    <AlertModal
                      title="Alert"
                      message="This is an alert!!!"
                      onClose={() => console.log('CLOSING THINGS!!!')}
                    />
                  );
                });
              }}
              tooltip="This is a button I swear! This is a button I swear! This is a button I swear!"
              tooltipSide="top"
            />

            <Button
              caption="I am a white button!"
              onPress={() => {
                this.getApp(({ app }) => {
                  app.pushModal(
                    <ConfirmModal
                      title="Confirm"
                      message="Are you SURE you want to do this?!?!?"
                      onClose={() => console.log('CLOSING!!!')}
                      onConfirm={() => console.log('CONFIRMED!!!')}
                    />
                  );
                });
              }}
              theme="white"
            />

            <TextField
              field="text"
              caption="Text Field"
              type="text"
              tooltip="This is a text field I swear!"
              tooltipSide="left"
            />

            <SelectField
              field="selected"
              caption="Select Option"
              options={options}
              tooltip="This is a select box I swear!"
              tooltipSide="bottom"
            />
          </View>
        </View>
      );
    }
  };
}, BasePage);

export { HomePage };

/* global API */

import { utils as U }                   from 'evisit-js-utils';
import React                            from 'react';
import { componentFactory, PropTypes }  from '@base';
import { CaptionedContainer }           from '@react-ameliorate/component-captioned-container';
import { Button }                       from '@react-ameliorate/component-button';
import { LayoutContainer }              from '@react-ameliorate/component-layout-container';
import { Form }                         from '@react-ameliorate/component-form';
import { SelectField }                  from '@react-ameliorate/component-select-field';
import * as lang                        from '@lang';
import styleSheet                       from './settings-controls-styles';

const SettingsControls = componentFactory('SettingsControls', ({ Parent, componentName }) => {
  return class SettingsControls extends Parent {
    static styleSheet = styleSheet;

    static propTypes = {
    };

    resolveState({ selectors, state }) {
      return {
        ...super.resolveState.apply(this, arguments),
        locale: selectors.getPreferenceValue(state, 'locale'),
        ...this.getState({
        })
      };
    }

    getLanguages() {
      return Object.keys(lang).reduce((obj, locale) => {
        obj[locale] = lang[locale].name;
        return obj;
      }, {});
    }

    async onApply() {
      var form = this.getReference('form'),
          formData = await form.value();

      console.log('Form data!', formData);

      var preferenceNames = Object.keys(formData),
          storePreferences = [];

      for (var i = 0, il = preferenceNames.length; i < il; i++) {
        var preferenceName  = preferenceNames[i],
            preferenceValue = formData[preferenceName],
            storePreference = this.getStore(({ selectors, state }) => selectors.getPreference(state, preferenceName));

        if (!storePreference)
          storePreference = { name: preferenceName };

        if (storePreference.value === preferenceValue)
          continue;

        storePreference.value = preferenceValue;
        storePreferences.push(storePreference);
      }

      try {
        console.log('Update preferences!', storePreferences);

        await API.endpoints.updatePreference({ data: storePreferences });

        this.getStore(({ dispatch, actions }) => {
        dispatch(actions.updatePreferences(storePreferences));
        });
      } catch (e) {
        console.error(e);
        // TODO: Handle error properly
      }
    }

    render(_children) {
      var languages = this.getLanguages();

      return (
        <LayoutContainer direction="horizontal" spacing={this.styleProp('DEFAULT_CONTENT_PADDING')}>
          <CaptionedContainer style={this.props.style} caption={this.langTerm('settings')}>
            <LayoutContainer direction="vertical" spacing={this.styleProp('DEFAULT_CONTENT_PADDING')}>
              <Form ref={this.captureReference('form')} style={this.style('form')}>
                <SelectField
                  field="locale"
                  caption={this.langTerm('language')}
                  options={languages}
                  tooltip={this.tooltipTerm('language')}
                  tooltipSide="right"
                  maxOptions={10}
                  defaultValue={this.getState('locale')}
                />
              </Form>

              <Button caption={this.langTerm('apply')} onPress={this.onApply}/>
            </LayoutContainer>
          </CaptionedContainer>
        </LayoutContainer>
      );
    }
  };
});

export { SettingsControls };

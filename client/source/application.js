/* globals io API */

import { utils as U }                         from 'evisit-js-utils';
import React                                  from 'react';
import {
  DEFAULT_LOCALE,
  componentFactory,
  Theme
}                                             from '@base';
import {
  ActivityIndicator,
  Pager,
  View,
  Overlay,
  ModalManager
}                                             from '@components';
import styleSheet                             from './application-styles';
import mainStyleSheet                         from './main-styles';
import { loadApplicationFonts }               from './fonts';
import { DataStore }                          from '@common/data-store';
import Pages                                  from '@pages';
import { getRegisteredPages }                 from '@base/utils';
import { Application as ApplicationBase }     from '@react-ameliorate/component-application';
import applicationIcons                       from './icons';
import { handleMessage, sendMessage }         from './worker-utils';

const DEFAULT_PAGE_INDEX = 3;

// Load fonts
loadApplicationFonts();

export const Application = componentFactory('Application', ({ Parent, componentName }) => {
  return class Application extends Parent {
    static styleSheet = styleSheet;

    constructor(props, ...args) {
      super(props, ...args);

      this.theme = new Theme();
      this.store = new DataStore({ debug: __DEV__ });
      this.ffmpegWorker = null;

      // Build style sheet for browser
      this._defineStyleSheetProperty('browserStyleSheet', mainStyleSheet);
    }

    ffmpegWorkerReceiveMessage(event) {
      handleMessage(event, {
        'ready': () => {
          console.log('Worker reports it is ready!');
        }
      });
    }

    ffmpegWorkerSendMessage(eventName, args) {
      if (!this.ffmpegWorker)
        return Promise.reject('Worker not available');

      return sendMessage(this.ffmpegWorker, eventName, args);
    }

    componentMounted() {
      super.componentMounted.apply(this, arguments);

      this.start();

      this.ffmpegWorker = new Worker("/js/ffmpeg_worker.js");
      this.ffmpegWorker.onmessage = this.ffmpegWorkerReceiveMessage;
    }

    componentUnmounting() {
      if (this.ffmpegWorker)
        this.ffmpegWorker.terminate();

      super.componentUnmounting.apply(this, arguments);
    }

    async start() {
      this.setState({ appReady: true });
      this.callProvidedCallback('onReady', { app: this });
    }

    provideContext() {
      var locale = this.locale = this.getState('locale');

      return {
        application: this,
        store: this.store,
        theme: this.theme,
        locale,
        iconGlyphMap: applicationIcons,
        iconDefaultFontFamily: 'music-studio'
      };
    }

    resolveState({ selectors, state }) {
      return {
        ...super.resolveState.apply(this, arguments),
        locale: selectors.getPreferenceValue(state, 'locale', DEFAULT_LOCALE),
        ...this.getState({
          appReady: false,
          currentPage: DEFAULT_PAGE_INDEX,
        })
      };
    }

    storeUpdated(newState, oldState) {
      if (newState.locale !== oldState.locale)
        this.forceUpdate();
    }

    getPages() {
      return getRegisteredPages.call(this);
    }

    onRequestPageChange({ tabIndex }) {
      this.setState({
        currentPage: tabIndex
      });
    }

    renderCurrentPage(args) {
      var { tab } = (args || {});
      if (!tab || typeof tab.createPageComponent !== 'function')
        return null;

      return tab.createPageComponent(tab.props, args);
    }

    renderCommon() {
      var { currentPage, _modals } = this.getState();

      return (
        <Overlay containerStyle={this.style('overlayContainer')}>
          <View className={this.getRootClassName(componentName)} style={this.style('container')}>
            <Pager
              tabs={this.getPages()}
              renderPage={this.renderCurrentPage}
              activeTab={this.getState('currentPage')}
              onPageChange={this.onRequestPageChange}
            />
          </View>

          <ModalManager modals={_modals}/>
        </Overlay>
      );
    }

    renderPlatformView() {
      return this.renderCommon();
    }

    render() {
      // This will update the browser style sheet (if needed)
      this.browserStyleSheet.getInternalStyleSheet();

      var appReady = this.getState('appReady');
      if (!appReady) {
        return (
          <View className={this.getRootClassName(componentName)} style={this.style('container', 'containerNotReady')}>
            <ActivityIndicator size="large" color={this.styleProp('MAIN_COLOR')}/>
          </View>
        );
      }

      return this.renderPlatformView();
    }
  };
}, { parent: ApplicationBase });

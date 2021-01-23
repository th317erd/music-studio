import React                              from 'react';
import * as ReactAmeliorate               from '@react-ameliorate-base/core';
import {
  Color,
  Theme,
  ThemeProperties,
  StyleSheetBuilder,
  createStyleSheet
}                                         from './theme';
import { toNumber, compileLanguageTerm }  from './utils';
import * as languages                     from '../lang';

// -------------- ComponentBase -------------- //

const PropTypes = ReactAmeliorate.PropTypes,
      DEFAULT_LOCALE = 'en_US';

// Create an overloaded base class for all components
const ComponentBase = ReactAmeliorate.componentFactory('ComponentBase', ({ Parent, componentName }) => {
  return class ComponentBase extends Parent {
    static propTypes = {
      style: PropTypes.any
    };

    getCurrentLocale() {
      var locale = this.locale || this.context.locale;
      return (!locale) ? DEFAULT_LOCALE : locale;
    }

    getLocaleLanguageTerms(_locale) {
      var locale = (_locale) ? _locale : this.getCurrentLocale(),
          lang   = languages[locale],
          terms  = (lang && lang.terms);

      if (!terms) {
        console.error(`Unknown locale: [${locale}]... falling back to ${DEFAULT_LOCALE}`);
        lang = languages[DEFAULT_LOCALE];
        terms = (lang && lang.terms);
      }

      if (!terms)
        throw new Error('No language packs defined');

      return terms;
    }

    langTerm(_termID, _params) {
      const getLocaleTerm = () => {
        for (var i = 0, il = termIDs.length; i < il; i++) {
          var thisTermID = termIDs[i],
              thisTerm = terms[thisTermID];

          if (thisTerm)
            return { term: thisTerm, termID: thisTermID };
        }
      };

      const throwTermNotFound = () => {
        throw new Error(`Requested language term '${(termIDs.length === 1) ? termIDs[0] : termIDs}', but no such term exists!`);
      };

      var params  = _params || {},
          locale  = this.getCurrentLocale(),
          terms   = this.getLocaleLanguageTerms(locale),
          termIDs = (Array.isArray(_termID)) ? _termID : [ _termID ],
          term    = getLocaleTerm();

      if (!term && locale !== DEFAULT_LOCALE) {
        console.warn(`Language pack ${locale} doesn't contain requested term '${(termIDs.length === 1) ? termIDs[0] : termIDs}'... falling back to ${DEFAULT_LOCALE}`);
        terms = this.getLocaleLanguageTerms(DEFAULT_LOCALE);
        term = getLocaleTerm();

        if (!term)
          throwTermNotFound();
      }

      if (!term)
        throwTermNotFound();

      return compileLanguageTerm({ terms, term: term.term, termID: term.termID, params, locale });
    }

    tooltipTerm(termID, _params) {
      return this.langTerm([ `${termID}_tooltip`, termID ], _params);
    }

    storeUpdated(newState, currentState) {
    }

    componentMounted() {
      super.componentMounted.apply(this, arguments);

      this.getStore(({ store }) => {
        Object.defineProperty(this, '_disconnectFromStore', {
          writable: true,
          enumerable: false,
          configurable: true,
          value: store.subscribe(() => {
            var currentState = this.getState(),
                newState = this._resolveState(false, this.props, this.props);

            this.setState(newState);
            this.storeUpdated(newState, currentState);
          })
        });
      });
    }

    componentUnmounting() {
      super.componentUnmounting.apply(this, arguments);

      if (typeof this._disconnectFromStore === 'function')
        this._disconnectFromStore();
    }

    _resolveState(initial, props, _props) {
      var store = this.getStore();
      if (!store)
        debugger;

      return this.resolveState({
        initial,
        props,
        _props,
        store,
        resolve: store.resolve,
        state: store.state,
        selectors: store.selectors,
        dispatch: store.dispatch,
        actions: store.actions
      });
    }

    getStore(cb) {
      var store = this.store || this.context.store;

      if (store && typeof cb === 'function') {
        return cb.call(this, {
          store,
          resolve: store.resolve,
          state: store.state,
          selectors: store.selectors,
          dispatch: store.dispatch,
          actions: store.actions
        });
      }

      return store;
    }
  };
});

// Wrap componentFactory to use our overloaded ComponentBase class (if no other base class is specified)
function componentFactory(name, definer, _opts) {
  var opts = (ReactAmeliorate.ComponentBase.isValidComponent(_opts)) ? { parent: _opts } : Object.assign({}, _opts || {});
  if (!opts.parent)
    opts.parent = ComponentBase;

  return ReactAmeliorate.componentFactory(name, definer, opts);
}

export {
  DEFAULT_LOCALE,
  React,
  PropTypes,
  ComponentBase,
  componentFactory,
  createStyleSheet,
  Color,
  Theme,
  ThemeProperties,
  StyleSheetBuilder
};

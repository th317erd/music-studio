import Color              from 'color';
import { utils, data }    from 'evisit-js-utils';

//###if(DEV) {###//
function defineGlobalProperties(props) {
  var keys = Object.keys(props),
      noop = () => {};

  keys.forEach((key) => {
    var prop = props[key];

    if (typeof prop === 'function') {
      Object.defineProperty(global, key, {
        enumerable: false,
        configurable: true,
        get: prop,
        set: noop
      });
    } else {
      Object.defineProperty(global, key, {
        writable: true,
        enumerable: false,
        configurable: true,
        value: prop
      });
    }
  });
}

Object.assign(global, {
  Color,
  U: utils,
  D: data
});

const onAppReady = ({ app }) => {
  global.app = app;

  defineGlobalProperties({
    state: () => app.store.state,
    selectors: () => app.store.selectors,
    store: () => app.store,
    theme: () => app.theme.getThemeProperties()
  });

  console.log('THEME: ', app.theme && app.theme.getThemeProperties());
};

export default {
  onAppReady
};

//###}###//

import { utils as U }                   from 'evisit-js-utils';
import { applyMiddleware, buildStore }  from 'redux-panoptic';
import preferences                      from './preferences';
import session                          from './session';

const storeParts = [
  preferences,
  session
];

// Define our template for our store
const dataStoreTemplate = {
        template: Object.assign({}, ...storeParts.map((part) => part.template)),
        selectors: Object.assign({}, ...storeParts.map((part) => part.selectors))
      },
      noop = () => {};

export class DataStore {
  constructor(_opts) {
    // Create some middleware to help us log dispatches
    var opts = _opts || {},
        dispatchActionMiddleware = (store) => (next) => (action) => {
          console.log('Dispatching action [' + action.type + ']: ', action.payload);
          return next(action);
        };

    var store = (opts.debug) ? buildStore(dataStoreTemplate.template, applyMiddleware(dispatchActionMiddleware)) : buildStore(dataStoreTemplate.template),
        dispatch = store.dispatch.bind(store),
        subscribers = [],
        oldState = store.getState(),
        updateTimer;

    U.defineRWProperty(this, 'resolve', this.resolve.bind(this));
    U.defineRWProperty(this, 'destroy', this.destroy.bind(this));
    U.defineRWProperty(this, 'op', this.op.bind(this));
    U.defineRWProperty(this, 'subscribe', this.subscribe.bind(this));
    U.defineRWProperty(this, 'getState', this.getState.bind(this));

    U.defineROProperty(this, '_store', undefined, () => store, noop);
    U.defineROProperty(this, '_subscribers', undefined, () => subscribers, noop);
    U.defineROProperty(this, 'dispatch', undefined, () => dispatch, noop);
    U.defineROProperty(this, 'actions', undefined, () => store.actions, noop);
    U.defineROProperty(this, 'selectors', undefined, () => dataStoreTemplate.selectors, noop);
    U.defineROProperty(this, 'state', undefined, () => store.getState(), noop);
    U.defineROProperty(this, 'multiDispatch', undefined, () => store.multiDispatch, noop);
    U.defineROProperty(this, 'multiDispatchReset', undefined, () => store.multiDispatchReset, noop);
    U.defineROProperty(this, 'multiDispatchSet', undefined, () => store.multiDispatchSet, noop);
    U.defineROProperty(this, 'multiDispatchUpdate', undefined, () => store.multiDispatchUpdate, noop);

    var _disconnectStoreListener = store.subscribe(() => {
      if (updateTimer)
        clearTimeout(updateTimer);

      updateTimer = setTimeout(() => {
        updateTimer = null;

        var state = store.getState();
        for (var i = 0; i < subscribers.length; i++) {
          var subscriber = subscribers[i];
          subscriber.callback.call(this, state, oldState, this);
        }

        oldState = state;
      }, 1);
    });

    U.defineROProperty(this, 'removeAllSubscribers', () => {
      subscribers = [];
      _disconnectStoreListener();
    }, noop);
  }

  resolve(thisPath, defaultValue) {
    return U.get(this.getState(), thisPath, defaultValue);
  }

  destroy() {
    this.removeAllSubscribers();
  }

  op(func) {
    return func.call(this, {
      state: this.state,
      selectors: this.selectors,
      dispatch: this.dispatch,
      actions: this.actions
    });
  }

  subscribe(func) {
    if (typeof func !== 'function')
      throw new Error('Subscribe argument must be a function');

    var subscribers = this._subscribers,
        subscriber = {
          callback: func
        };

    subscribers.push(subscriber);

    return function() {
      var index = subscribers.indexOf(subscriber);
      if (index >= 0)
        subscribers.splice(index, 1);
    };
  }

  getState() {
    return this._store && this._store.getState();
  }
}

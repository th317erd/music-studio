/*
  Modified Chainable interface from Xoumz project (https://github.com/th317erd/xoumz)
  used and modified by permission of the author (Wyatt Greenway) - 09/02/2018
*/

/*
 * Chainable
 ** Allow abstract property getting / setting on any child class
 ** this works via javascript Proxy objects
 */

const { memoizeModule } = require('../base-utils');

module.exports = memoizeModule(function(_globalOpts) {
  const globalOpts = _globalOpts || {},
        U = require('evisit-js-utils').utils,
        D = require('evisit-js-utils').data;

  // This is the proxy getter / setter
  function chainableConsumerPropHelper(isGet, target, key, value, proxy) {
    // If what is being asked for is a symbol
    // or starts with an underscore then return it
    if (typeof key === 'symbol' || key.charAt(0) === '_')
      return target[key];

    // Proxy request to internal dollar-sign method (if it exists)
    var native = (!target._done) ? target.constructor.prototype[`$${key}`] : undefined;
    if (typeof native === 'function') {
      var ret = (isGet) ? native.call(target) : native.call(target, value);
      if (target._done)
        return ret;

      return chainableConsumerProxy(target, native);
    }

    // If what is being asked for exists on the target than return it
    if (isGet && (key in target)) {
      var val = target[key];
      return (typeof val === 'function') ? val.bind(target) : val;
    }

    // Finally if nothing else was found call $_default method
    if (!target._done && typeof native !== 'function') {
      native = target.constructor.prototype['$_default'];
      var ret = (isGet) ? native.call(target, key) : native.call(target, key, value);
      if (target._done)
        return ret;

      return chainableConsumerProxy(target, native, key);
    }

    // If we have already locked this chain then throw an error
    // (we should never get here unless nothing is found in the instance and we are locked)
    if (target._done)
      throw new Error('Can not continue with chainable: chainable has been finalized');

    // We should only ever get here is something failed really badly...
    return proxy;
  }

  // Spin up a new proxy for the target
  function chainableConsumerProxy(target, callFunc, callFuncKeyName) {
    // If we are finalized simply return the target
    if (target._done)
      return target;

    // Otherwise make a proxy of the target
    var proxyTarget = (typeof callFunc === 'function') ? callFunc : target,
        proxy = new Proxy(proxyTarget, {
          get: (_, key, proxy) => {
            if (typeof key !== 'symbol' && key.charAt(0) === '_')
                return _[key];

            return chainableConsumerPropHelper(true, target, key, undefined, proxy);
          },
          set: (_, key, value, proxy) => chainableConsumerPropHelper(false, target, key, value, proxy),
          apply: (_, thisArg, argumentList) => {
            if (!(typeof callFunc === 'function'))
              throw new Error('Unable to call object');

            var ret = (callFuncKeyName)
                        ? callFunc.call(target, callFuncKeyName, ...argumentList)
                        : callFunc.call(target, ...argumentList);

            return (!ret || ret === target) ? chainableConsumerProxy(target, undefined, undefined) : ret;
          }
        });

    if (!proxy.hasOwnProperty('_proxyTarget'))
      U.defineRWProperty(proxy, '_proxyTarget', target);

    return proxy;
  }

  // This is the guts of Chainable
  class Chainable {
    constructor(...args) {
      U.defineROProperty(this, '_arguments', args);
      U.defineRWProperty(this, '_done', false);
    }

    start() {
      return chainableConsumerProxy(this);
    }

    finalize() {
      // Are we already finalized?
      if (this._done)
        return this;

      // Finalize chainable proxy and return target
      this._done = true;
      delete this._proxyTarget;

      return this;
    }

    clone(...args) {
      var copy = new this.constructor(...this._arguments);

      D.extend(true, copy, this._proxyTarget || this);
      copy._done = false;

      return copy.start(...this._arguments);
    }

    getPropValue(propName) {
      var target = this._proxyTarget || this;
      return target[propName];
    }

    *keys() {
      var target = this._proxyTarget || this,
          keys = Object.keys(target);

      for (var i = 0, il = keys.length; i < il; i++)
        yield keys[i];
    }

    *values() {
      var target = this._proxyTarget || this,
          keys = Object.keys(target);

      for (var i = 0, il = keys.length; i < il; i++)
        yield target[keys[i]];
    }

    *entries() {
      var target = this._proxyTarget || this,
          keys = Object.keys(target);

      for (var i = 0, il = keys.length; i < il; i++) {
        var key = keys[i],
            value = target[key];

        yield [ key, value ];
      }
    }

    *[Symbol.iterator]() {
      yield *this.entries();
    }

    $_default(name, value) {
      if (arguments.length < 3)
        this[name] = true;
      else
        this[name] = value;
    }
  }

  return {
    Chainable
  };
});

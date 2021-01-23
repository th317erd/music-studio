/*
  Modified lazy collections Xoumz project (https://github.com/th317erd/xoumz)
  used and modified by permission of the author (Wyatt Greenway) - 09/02/2018
*/

/*
 * LazyItem
 ** An item whose referenced value may or may not yet be available
 */

/*
 * LazyCollection
 ** A collection of LazyItems
 ** This class is mainly used for loading items in a sane way from the database
 ** The iterface deliberately mirrors a normal javascript Array, however most
 ** opperations are naturally asynchronous instead of synchronous like an Array
 */

const { memoizeModule } = require('../base-utils');

module.exports = memoizeModule(function(_globalOpts) {
  const globalOpts = _globalOpts || {},
        U = require('evisit-js-utils').utils;

  function equal(item1, item2) {
    if (item1 === item2)
      return true;

    if (typeof item1 === 'number' && typeof item2 === 'number') {
      if (isNaN(item1) && isNaN(item2))
        return true;

      if (!isFinite(item1) && !isFinite(item2))
        return true;
    }

    if (item1 && item2 && typeof item1.valueOf === 'function' && typeof item2.valueOf === 'function' && item1.valueOf() === item2.valueOf())
      return true;

    return false;
  }

  function convertToLazyItems(src, dst, method = 'push') {
    var items = dst,
        oldLength = dst.length,
        values = src;

    if (src && typeof src.values === 'function')
      values = src.values();
    else if (src && src instanceof Object)
      values = Object.keys(src).map((key) => src[key]);
    else if (!values)
      values = [];

    for (var item of values) {
      // If item isn't a lazy item, then make it one...
      if (!U.instanceOf(item, LazyItem))
        item = new LazyItem(item);

      items[method](item);
    }

    if (this._items === dst)
      updateIndices.call(this, oldLength);

    return dst;
  }

  function flattenItems(...args) {
    var finalItems = [];

    for (var i = 0, il = args.length; i < il; i++) {
      var item = args[i];

      if (!item || typeof item.values !== 'function') {
        finalItems.push(item);
        continue;
      }

      if (U.instanceOf(item, LazyCollection)) {
        finalItems = finalItems.concat(item._items);
        continue;
      }

      for (var value of item.values())
        finalItems.push(value);
    }

    return finalItems;
  }

  function updateIndices(oldLength) {
    function createIndexKey(index) {
      Object.defineProperty(this, i, {
        enumerable: true,
        configurable: true,
        get: () => this.index(index, false),
        set: (val) => {
          this._items[index] = new LazyItem(val);
          return val;
        }
      });
    }

    // Add new index properties
    for (var i = oldLength, il = this.count(); i < il; i++)
      createIndexKey.call(this, i);

    // Remove old index properties
    for (var i = this.count(), il = oldLength; i < il; i++)
      delete this[i];
  }

  class LazyItem {
    constructor(item, fetchInfo) {
      U.defineRWProperty(this, '_loading', null);

      if (U.instanceOf(item, LazyItem)) {
        this._loading = item._loading;

        if (item.hasOwnProperty('_result'))
          U.defineRWProperty(this, '_result', item._result);

        U.defineROProperty(this, '_fetch', item._fetch);
        U.defineROProperty(this, '_fetchInfo', item._fetchInfo);
      } else if (typeof item !== 'function') {
        U.defineRWProperty(this, '_result', item);
        U.defineROProperty(this, '_fetchInfo', fetchInfo);
      } else {
        U.defineROProperty(this, '_fetch', item);
        U.defineROProperty(this, '_fetchInfo', fetchInfo);
      }
    }

    async fetch() {
      if (this.hasOwnProperty('_result'))
        return this._result;

      if (this._loading)
        return await this._loading;

      var loading = this._loading = this._fetch(),
          result = await loading;

      U.defineRWProperty(this, '_result', result);

      return result;
    }

    info() {
      var fetchInfo = this._fetchInfo;
      if (typeof fetchInfo !== 'function')
        return;

      return fetchInfo(this);
    }

    loaded() {
      return this.hasOwnProperty('_result');
    }

    value() {
      return this._result;
    }

    resolveWith(result) {
      U.defineRWProperty(this, '_result', result);
    }
  }

  class LazyCollection {
    static from(iterable) {
      var collection = new LazyCollection();
      convertToLazyItems.call(collection, iterable, collection._items);
      return collection;
    }

    static of(...args) {
      return LazyCollection.from(args);
    }

    constructor(...incomingItems) {
      var items = convertToLazyItems.call(this, flattenItems(...incomingItems), []);

      U.defineRWProperty(this, 'length', undefined, () => this.count(), (set) => {
        if (!set)
          return;

        var items = this._items;
        for (var i = set, il = items.length; i < il; i++)
          items[i] = null;

        items.length = set;
      });

      U.defineRWProperty(this, '_items', items);
      U.defineRWProperty(this, '_mutator', null);
    }

    valueOf() {
      return this._items.slice();
    }

    mutator(cb) {
      if (arguments.length === 0)
        return this._mutator;

      if (typeof cb !== 'function')
        throw new TypeError('LazyCollection item mutator must be a function');

      var func = this._mutator;
      U.defineRWProperty(this, '_mutator', (_item, index) => {
        var item = (typeof func === 'function') ? func.call(this, _item, index) : _item;
        return cb.call(this, item, index);
      });

      return this._mutator;
    }

    mutateItem(item, index, eager) {
      var mutator = this._mutator;
      return (typeof mutator === 'function') ? mutator.call(this, item, index, eager) : item;
    }

    fetcher(cb) {
      if (arguments.length === 0)
        return this._fetcher;

      if (typeof cb !== 'function')
        throw new TypeError('LazyCollection item fetcher must be a function');

      U.defineRWProperty(this, '_fetcher', cb);

      return this._fetcher;
    }

    async fetchItem(index, eager) {
      var fetcher = this._fetcher;
      if (typeof fetcher !== 'function') {
        var item = this._items[index];
        return (item.loaded()) ? item.value() : await item.fetch();
      }

      return await fetcher.call(this, index, eager, this._items);
    }

    concat(...concatItems) {
      return new LazyCollection(this._items, ...concatItems);
    }

    push(...args) {
      convertToLazyItems.call(this, args, this._items);
      return this.count();
    }

    unshift(...args) {
      var items = convertToLazyItems.call(this, args, []);
      this._items.unshift(...items);
      return this.count();
    }

    async pop() {
      var ret = this.last(),
          oldLength = this.count();

      this._items.pop();
      updateIndices.call(this, oldLength);

      return await ret;
    }

    async shift() {
      if (!this.count())
        return;

      var ret = this.first(),
          oldLength = this.count();

      this._items.shift();
      updateIndices.call(this, oldLength);

      return await ret;
    }

    slice(...args) {
      return new LazyCollection(this._items.slice(...args));
    }

    splice(start, deleteCount, ...args) {
      var oldLength = this.count(),
          removedItems = this._items.splice(start, deleteCount),
          insertItems = convertToLazyItems(args, []);

      this._items.splice(start, 0, ...insertItems);
      updateIndices.call(this, oldLength);

      return new LazyCollection(removedItems);
    }

    async indexOf(searchElement, fromIndex, reverse) {
      for (var [ index, value ] of this.entries(true, fromIndex, reverse)) {
        var item = await value;

        if (equal(item, searchElement))
          return index;
      }

      return -1;
    }

    async lastIndexOf(searchElement, fromIndex) {
      return await this.indexOf(searchElement, fromIndex, true);
    }

    async includes(searchElement, fromIndex) {
      var index = await this.indexOf(searchElement, fromIndex);
      return (index >= 0);
    }

    async forEach(callback, thisArg) {
      for (var [ index, value ] of this.entries(true)) {
        var item = await value;
        callback.call(thisArg, item, index, this);
      }
    }

    async filter(callback, thisArg) {
      var newItems = [];
      for (var [ index, value, lazyItem ] of this.entries(true)) {
        var item = await value,
            keep = callback.call(thisArg, item, index, this);

        if (keep)
          newItems.push(lazyItem);
      }

      return new LazyCollection(newItems);
    }

    async every(callback, thisArg) {
      for (var [ index, value ] of this.entries(true)) {
        var item = await value,
            valid = callback.call(thisArg, item, index, this);

        if (!valid)
          return false;
      }

      return true;
    }

    async some(callback, thisArg) {
      for (var [ index, value ] of this.entries(true)) {
        var item = await value,
            valid = callback.call(thisArg, item, index, this);

        if (valid)
          return true;
      }

      return false;
    }

    async reduce(callback, _initial) {
      var initial = _initial,
          firstIndex = 0;

      if (arguments.length === 1 && !this.count())
        throw new TypeError('Reduce of empty array with no initial value');

      for (var [ index, value ] of this.entries(true)) {
        var item = await value,
            initial = (index === firstIndex && arguments.length === 1) ? item : callback(initial, item, index, this);
      }

      return initial;
    }

    async reduceRight(callback, _initial) {
      var initial = _initial,
          firstIndex = this.count() - 1;

      if (arguments.length === 1 && !this.count())
        throw new TypeError('Reduce of empty array with no initial value');

      for (var [ index, value ] of this.entries(true, undefined, true)) {
        var item = await value,
            initial = (index === firstIndex && arguments.length === 1) ? item : callback(initial, item, index, this);
      }

      return initial;
    }

    toString() {
      return `LazyCollection[${this.count()}]`;
    }

    toLocaleString() {
      return this.toString();
    }

    async join(...args) {
      var finalItems = new Array(this.count());
      for (var [ index, value ] of this.entries(true)) {
        var item = await value;
        finalItems[index] = item;
      }

      return finalItems.join(...args);
    }

    reverse() {
      this._items.reverse();
      return this;
    }

    async sort(_callback) {
      // Request load of every item
      var count = this.count(),
          promises = [];

      for (var i = 0, il = count; i < il; i++)
        promises.push(this.index(i, true));

      // Wait for loading to finish
      await Promise.all(promises);

      // Sort items
      var callback = (_callback instanceof Function) ? _callback : null;
      this._items.sort((a, b) => {
        var x = a.value(),
            y = b.value();

        if (!callback)
          return (x == y) ? 0 : (x < y) ? -1 : 1;

        return callback(x, y);
      });

      return this;
    }

    async find(callback, thisArg) {
      for (var [ index, value ] of this.entries(true)) {
        var item = await value,
            valid = callback.call(thisArg, item, index, this);

        if (valid)
          return item;
      }
    }

    async findIndex(callback, thisArg) {
      for (var [ index, value ] of this.entries(true)) {
        var item = await value,
            valid = callback.call(thisArg, item, index, this);

        if (valid)
          return index;
      }

      return -1;
    }

    *entries(parallel, fromIndex, reverse) {
      var count = this.count();

      // Load all items at once if this is a parallel operation
      if (parallel) {
        for (var i = fromIndex, il = count; i < il; i++)
          this.index(i, true);
      }

      if (reverse) {
        let startIndex = (fromIndex === undefined) ? (count - 1) : fromIndex;
        if (startIndex < 0)
          startIndex = 0;

        if (startIndex >= count)
          startIndex = count;

        for (let i = startIndex; i >= 0; i--)
          yield [ i, this.index(i, true) ];
      } else {
        let startIndex = (fromIndex === undefined) ? 0 : fromIndex;
        if (startIndex < 0)
          startIndex = 0;

        if (startIndex >= count)
          startIndex = count;

        for (let i = startIndex, il = count; i < il; i++)
          yield [ i, this.index(i, true) ];
      }
    }

    *keys(fromIndex = 0) {
      for (var i = fromIndex, il = this.count(); i < il; i++)
        yield i;
    }

    *values(parallel, fromIndex = 0) {
      for (var [ , value ] of this.entries(parallel, fromIndex))
        yield value;
    }

    *[Symbol.iterator]() {
      yield* this.entries(true);
    }

    async map(callback, thisArg) {
      var newValues = new Array(this.count());
      for (var [ index, value ] of this.entries(true)) {
        var item = await value,
            newValue = callback.call(thisArg, item, index, this);

        newValues[index] = newValue;
      }

      return new LazyCollection(newValues);
    }

    async index(offset, eager) {
      if (offset == null)
        return;

      var count = this.count();
      if (offset < 0 || offset >= count)
        return;

      var item = await this.fetchItem(offset, eager);
      return this.mutateItem(item, offset, eager);
    }

    where(query) {
      // TODO: Implement
    }

    first() {
      var count = this.count();
      if (!count)
        return;

      return this.index(0, false);
    }

    last() {
      var count = this.count();
      if (!count)
        return;

      return this.index(count - 1, false);
    }

    async all() {
      var newValues = new Array(this.count());

      for (var [ index, value ] of this.entries(true)) {
        var item = await value;
        newValues[index] = item;
      }

      return newValues;
    }

    count() {
      return this._items.length;
    }

    loadedItems(all) {
      var items = this._items,
          loadedItems = [];

      for (var i = 0, il = items.length; i < il; i++) {
        var item = items[i];
        if (item.loaded())
          loadedItems.push(this.mutateItem(item.value(), i, false));
        else if (all)
          loadedItems.push(undefined);
      }

      return loadedItems;
    }
  }

  return {
    LazyItem,
    LazyCollection
  };
});

import {
  capitalize,
  regexpEscape,
  toNumber,
  copyStaticMethods,
  parseURIParts
} from '../../../common/base-utils';

export {
  findDOMNode,
  nextTick,
  filterObjectKeys,
  isElementOrDescendant,
  isDescendantElement,
  preventEventDefault,
  stopEventImmediatePropagation,
  stopEventPropagation,
  insertStyleSheet,
  getLargestFlag,
  getDraggedItems,
  setDraggedItems,
  isPromise
} from '@react-ameliorate/utils';

const noop = (() => {}),
      registeredPages = {};

export function registerPage(pageName, pageInfo) {
  registeredPages[pageName] = pageInfo;
}

export function getRegisteredPages() {
  var pageNames = Object.keys(registeredPages);
  return pageNames.map((pageName) => registeredPages[pageName].call(this)).sort((a, b) => a.order - b.order);
}

export function cloneObject(obj) {
  if (obj == null)
    return obj;

  var type = typeof obj;
  if (['number', 'boolean', 'string'].indexOf(type) >= 0)
    return obj;

  if (obj instanceof Number || obj instanceof Boolean || obj instanceof String)
    return new obj.constructor(obj.valueOf());

  if (Array.isArray(obj))
    return obj.slice();

  if (obj.constructor === Object.prototype.constructor)
    return Object.assign({}, obj);

  if (typeof obj.clone === 'function')
    return obj.clone();

  var clone = new obj.constructor();
  return Object.assign(clone, obj);
}

export function compileLanguageTerm(args) {
  var term = args.term;
  return (typeof term === 'function') ? term.call(this, args) : term;
}

export {
  capitalize,
  regexpEscape,
  toNumber,
  copyStaticMethods,
  noop,
  parseURIParts
};

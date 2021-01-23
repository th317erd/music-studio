
import { utils as U }                       from 'evisit-js-utils';
import { toNumber }                         from '@base/utils';
import { createReducer as rpCreateReducer } from 'redux-panoptic';
import { createSelector }                   from 'reselect';
import createCachedSelector                 from 're-reselect';

const noop          = (val) => val,
      noopFormatter = (state, val) => val;

function mapToKeys(_keys, formatter = noop) {
  var keys = (Array.isArray(_keys)) ? _keys : [_keys];

  return rpCreateReducer(function(_data, remove) {
    var newState = Object.assign({}, this),
        data = (Array.isArray(_data)) ? _data : [_data],
        now = (new Date()).getTime();

    for (var i = 0, il = data.length; i < il; i++) {
      var val = data[i];
      if (!val)
        continue;

      val = val.valueOf();

      for (var j = 0, jl = keys.length; j < jl; j++) {
        var key = val[keys[j]];
        if (key == null)
          continue;

        if (remove === true) {
          delete newState[key];
          continue;
        }

        var currentVal = newState[key];
        if (currentVal && currentVal.data && val && val.data)
          val = Object.assign({}, currentVal.data, val.data);

        key = formatter(key, val);

        newState[key] = {
          lastUpdateTime: now,
          data: val
        };
      }
    }

    return newState;
  }, {});
}

function convertToArray(formatter = noopFormatter) {
  return function(state) {
    var items = [];

    for (var i = 1, il = arguments.length; i < il; i++) {
      var thisArg = arguments[i];
      if (thisArg == null || thisArg === '')
        continue;

      var keys = Object.keys(thisArg);
      for (var j = 0, jl = keys.length; j < jl; j++) {
        var key = keys[j],
            item = thisArg[key];

        if (!item)
          continue;

        items.push(formatter(state, item.data));
      }
    }

    return items;
  };
}

function getID(obj) {
  var id = (obj && obj.hasOwnProperty('id')) ? obj.id : obj;
  return id;
}

function convertArgs(args) {
  return args.map((arg) => {
    if (U.instanceOf(arg, 'string', 'number', 'boolean')) {
      var key = ('' + arg);
      return ((state) => {
        var value = U.get(state, key);
        return value;
      });
    }

    return arg;
  });
}

const mapToID = mapToKeys('id'),
      createReducer = rpCreateReducer,
      customCreateSelector = function(...args) {
        return createSelector((state) => state, ...convertArgs(args));
      },
      customCreateCachedSelector = function(...args) {
        return createCachedSelector((state) => state, ...convertArgs(args));
      };

export {
  mapToID,
  mapToKeys,
  getID,
  createReducer,
  convertToArray,
  customCreateSelector as createSelector,
  customCreateCachedSelector as createCachedSelector
};

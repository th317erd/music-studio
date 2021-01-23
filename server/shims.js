module.exports = function() {
  // Shim object to have values / keys / entries (if they don't already exist)
  if (!Array.prototype.hasOwnProperty('values')) {
    Object.defineProperty(Array.prototype, 'values', {
      writable: true,
      enumerable: false,
      configurable: true,
      value: function*() {
        for (var i = 0, il = this.length; i < il; i++)
          yield this[i];
      }
    });
  }

  if (!Object.prototype.hasOwnProperty('keys')) {
    Object.defineProperty(Object.prototype, 'keys', {
      writable: true,
      enumerable: false,
      configurable: true,
      value: function*() {
        var keys = Object.keys(this);
        for (var i = 0, il = keys.length; i < il; i++)
          yield keys[i];
      }
    });
  }

  if (!Object.prototype.hasOwnProperty('values')) {
    Object.defineProperty(Object.prototype, 'values', {
      writable: true,
      enumerable: false,
      configurable: true,
      value: function*() {
        var keys = Object.keys(this);
        for (var i = 0, il = keys.length; i < il; i++)
          yield this[keys[i]];
      }
    });
  }

  if (!Object.prototype.hasOwnProperty('entries')) {
    Object.defineProperty(Object.prototype, 'entries', {
      writable: true,
      enumerable: false,
      configurable: true,
      value: function*() {
        var keys = Object.keys(this);
        for (var i = 0, il = keys.length; i < il; i++) {
          var key = keys[i],
              value = this[key];

          yield [ key, value ];
        }
      }
    });
  }

  if (!Object.prototype.hasOwnProperty(Symbol.iterator)) {
    Object.defineProperty(Object.prototype, Symbol.iterator, {
      writable: true,
      enumerable: false,
      configurable: true,
      value: function*() {
        yield* Object.prototype.entries.call(this);
      }
    });
  }
};

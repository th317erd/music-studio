const { memoizeModule } = require('./base-utils');

module.exports = memoizeModule(function(_globalOpts) {
  const globalOpts = _globalOpts || {},
        colors = require('colors'),
        logLevel = (globalOpts.logLevel || 'E').toUpperCase();

  class Logger {
    isVerboseLevel() {
      return ((/^(V)$/).test(logLevel));
    }

    isDebugLevel() {
      return ((/^(V|D)$/).test(logLevel));
    }

    isLogLevel() {
      return ((/^(V|D|I)$/).test(logLevel));
    }

    isWarnLevel() {
      return ((/^(V|D|I|W)$/).test(logLevel));
    }

    isErrorLevel() {
      return ((/^(V|D|I|W|E)$/).test(logLevel));
    }

    consoleWrite(type, ...args) {
      var colorKeys = {
            'verbose': 'magenta',
            'debug': 'green',
            'log': 'cyan',
            'warn': 'yellow',
            'error': 'red'
          },
          colorKey = colorKeys[type] || 'grey',
          consoleType = (type === 'verbose') ? 'log' : type;

      console[consoleType](...(args.map((_arg) => {
        var arg = _arg;
        if (arg && typeof arg.valueOf() === 'function')
          arg = arg.valueOf();

        if (arg == null || ['string', 'number', 'boolean'].indexOf(typeof arg) >= 0)
          return colors[colorKey]('' + arg);

        return arg;
      })));
    }

    verbose(...args) {
      if (this.isVerboseLevel())
        this.consoleWrite('verbose', ...args);
    }

    debug(...args) {
      if (this.isDebugLevel())
        this.consoleWrite('debug', ...args);
    }

    warn(...args) {
      if (this.isWarnLevel())
        this.consoleWrite('warn', ...args);
    }

    info(...args) {
      if (this.isLogLevel())
        this.consoleWrite('log', ...args);
    }

    error(...args) {
      if (this.isErrorLevel())
        this.consoleWrite('error', ...args);
    }
  }

  return {
    Logger: new Logger()
  };
});

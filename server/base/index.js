const { memoizeModule } = require('../base-utils');

module.exports = memoizeModule(function(_globalOpts) {
  const globalOpts = _globalOpts || {},
        { Chainable } = require('./chainable')(globalOpts),
        {
          QueryBuilder,
          QueryBuilderSerializer,
          QueryBuilderUnserializer
        } = require('./query-builder')(globalOpts),
        { LazyItem, LazyCollection } = require('./lazy-collection')(globalOpts);

  return {
    Chainable,
    QueryBuilder,
    QueryBuilderSerializer,
    QueryBuilderUnserializer,
    LazyItem,
    LazyCollection
  };
});

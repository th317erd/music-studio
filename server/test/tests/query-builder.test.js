const { QueryBuilder } = require('../../base/query-builder')({ test: true });

describe('QueryBuilder', function() {
  it('do a join with a query builder', function() {
    var fullQuery = new QueryBuilder();
    fullQuery = fullQuery.model('fluid').join((query) => {
      return query.model('fluid_sources').fluid_sources_fluid_id.matches('fluid.id');
    }).and((query) => {
      return query.model('fluid_sources').heartbeats_heartbeat_id.eq('HB:b9c62f26-7e1b-44fc-89da-b39400b38546');
    }).order('fluid_sources.fluid_sources_fluid_order DESC').finalize();

    var sqlString = fullQuery.toSQL();
    expect(sqlString).toMatchSnapshot();
  });

  it('serialize a query builder', function() {
    var query = new QueryBuilder().model('heartbeat').id.eq('test').name.like('*derp*').time.gt('2018-09-21').order('id').limit(10).offset(1).finalize();
    var serialized = query.serialize();
    expect(serialized).toMatchSnapshot();
  });

  it('deserialize a query builder', function() {
    var serialized = '["id ASC",10,1,100]heartbeat:id="test"&heartbeat:name%"*derp*"&heartbeat:time>"2018-09-21"';
    var query = QueryBuilder.unserialize(serialized);
    expect(query.serialize()).toBe(serialized);
  });
});

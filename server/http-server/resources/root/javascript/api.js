/* eslint-disable no-unused-vars */

const utils = require('@root/base-utils');

module.exports = utils.memoizeModule(function(_globalOpts) {
  const globalOpts = _globalOpts || {},
        base64                    = require('base-64'),
        U                         = require('evisit-js-utils').utils,
        { APIBase, APIRouteBase } = require('./api-base')(globalOpts),
        { QueryBuilder }          = require('@root/base/query-builder')(globalOpts);

  /*###ITERATE_SCHEMA((mn, MN) => {
    var moduleName = mn.replace(/_/g, '-');
    return `\n  const { ${MN} } = require('@root/models/${moduleName}')(globalOpts);`;
  });###*/

  function createAPILayer(application) {
    function convertItemsToModels(ModelClass, response) {
      var items = U.get(response, 'body.data.items');

      if (items) {
        var newItems = items.map((item) => ModelClass.create(item));
        U.set(response, 'body.data.items', newItems);
      }

      return response;
    }

    // Here we use the pre-processor to generate all routes based off
    // the defined schema
    const API = new APIBase(function(register) {
    /*###ITERATE_SCHEMA((mn, MN, { urlBase, primaryKeyFieldName }) => {
      return `
      register('get${MN}', APIRouteBase, function(APIRoute) {
        return class Get${MN}Route extends APIRoute {
          constructor() {
            super(...arguments);

            this.require(this, 'id');

            this.routeOptions({
              method: 'GET',
              url: \`${urlBase}/${mn}/\${this.id}\`
            });
          }

          async beforeSuccess(...args) {
            var response = await super.beforeSuccess(...args);
            return convertItemsToModels.call(this, ${MN}, response);
          }

          async success(...args) {
            var response = await super.success(...args);
            return U.get(response, 'body.data.items.0');
          }
        };
      });

      register('get${MN}s', APIRouteBase, function(APIRoute) {
        return class Get${MN}sRoute extends APIRoute {
          constructor() {
            super(...arguments);

            this.routeOptions({
              method: 'GET',
              url: '${urlBase}/${mn}',
              data: {
                offset: this.offset,
                limit: this.limit,
                order: this.order
              }
            });
          }

          async beforeSuccess(...args) {
            var response = await super.beforeSuccess(...args);
            return convertItemsToModels.call(this, ${MN}, response);
          }

          async success(...args) {
            var response = await super.success(...args);
            return U.get(response, 'body.data.items');
          }
        };
      });

      register('search${MN}s', APIRouteBase, function(APIRoute) {
        return class Search${MN}sRoute extends APIRoute {
          constructor() {
            super(...arguments);

            this.require(this, 'query');
            var serializedQuery = base64.encode(this.query.finalize().serialize()).toString();

            this.routeOptions({
              method: this.method || 'GET',
              url: '${urlBase}/${mn}',
              data: {
                query: serializedQuery
              }
            });
          }

          async beforeSuccess(...args) {
            var response = await super.beforeSuccess(...args);
            return convertItemsToModels.call(this, ${MN}, response);
          }

          async success(...args) {
            var response = await super.success(...args);
            return U.get(response, 'body.data.items');
          }
        };
      });

      register('create${MN}', APIRouteBase, function(APIRoute) {
        return class Create${MN}Route extends APIRoute {
          constructor() {
            super(...arguments);

            this.require(this, 'data');

            this.routeOptions({
              method: 'POST',
              url: '${urlBase}/${mn}',
              data: this.data
            });
          }

          async beforeSuccess(...args) {
            var response = await super.beforeSuccess(...args);
            return convertItemsToModels.call(this, ${MN}, response);
          }

          async success(...args) {
            var response = await super.success(...args);
            return U.get(response, 'body.data.items');
          }
        };
      });

      register('update${MN}', APIRouteBase, function(APIRoute) {
        return class Update${MN}Route extends APIRoute {
          constructor() {
            super(...arguments);

            this.require(this, 'data');
            if (!Array.isArray(this.data)) {
              this.require(this, 'id');
              data['${primaryKeyFieldName}'] = this.id;
            }

            this.routeOptions({
              method: 'PUT',
              url: '${urlBase}/${mn}',
              data: this.data
            });
          }

          async beforeSuccess(...args) {
            var response = await super.beforeSuccess(...args);
            return convertItemsToModels.call(this, ${MN}, response);
          }

          async success(...args) {
            var response = await super.success(...args);
            return U.get(response, 'body.data.items');
          }
        };
      });

      register('delete${MN}', APIRouteBase, function(APIRoute) {
        return class Delete${MN}Route extends APIRoute {
          constructor() {
            super(...arguments);

            this.require(this, 'id');

            this.routeOptions({
              method: 'DELETE',
              url: \`${urlBase}/${mn}/\${this.id}\`
            });
          }

          async beforeSuccess(...args) {
            var response = await super.beforeSuccess(...args);
            return convertItemsToModels.call(this, ${MN}, response);
          }

          async success(...args) {
            var response = await super.success(...args);
            return U.get(response, 'body.data.items');
          }
        };
      });
    `;
    });###*/
    });

    function buildQueryInterface(TYPE, type, method) {
      var qb = new QueryBuilder({
        onExec: (query) => (API[`search${TYPE}s`]({ query, method }))
      });

      return qb.model(type);
    }

    /*###ITERATE_SCHEMA((mn, MN) => {
      return `\n  API['query${MN}s'] = () => buildQueryInterface('${MN}', '${mn}', 'GET');\nAPI['delete${MN}s'] = () => buildQueryInterface('${MN}', '${mn}', 'DELETE');`;
    });###*/

    return API;
  }

  return {
    createAPILayer
  };
});

var _ = require('lodash');

module.exports = [
  function () {
    var provider = this;

    provider.$get = ['force', function (force) {

      var defaultFields = [ 'Id', 'Name' ];

      function shallowClearAndCopy(src, dst) {
        dst = dst || {};

        angular.forEach(dst, function(value, key) {
          delete dst[key];
        });

        for (var key in src) {
          if (src.hasOwnProperty(key) && !(key.charAt(0) === '$' && key.charAt(1) === '$')) {
            dst[key] = src[key];
          }
        }

        return dst;
      }

      function factory(sobjectType) {

        function SfResource(value) {
          shallowClearAndCopy(value || {}, this);
        };

        SfResource.get = function (id) {
          var result = new SfResource({});

          result.$promise = force.retrieve(sobjectType, id, null).then(function (res) {
            shallowClearAndCopy(res, result);
            return result;
          });

          return result;
        };

        SfResource.query = function (fields, conditions) {
          fields = fields || defaultFields;
          conditions = conditions || 'Id != NULL';

          var query = 'SELECT ';
          query += _.join(fields, ',');
          query += ' FROM ' + sobjectType;
          query += ' WHERE ' + conditions;
          var results = [];

          results.$promise = force.query(query).then(function (result) {
            Array.prototype.push.apply(results, _.map(result.records, function (item) {
              return new SfResource(item);
            }));

            return results;
          });

          return results;
        }

        return SfResource;
      }

      return factory;
    }];
  }
];

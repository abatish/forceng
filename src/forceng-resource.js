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

        var SoqlQueryBuilder = function () {
          this.fields = [];
          this.conditions = [];
        };

        SoqlQueryBuilder.prototype.select = function (fields) {
          this.fields = _.isArray(fields) ? fields : [fields];
          return this;
        };

        SoqlQueryBuilder.prototype.where = function (condition) {
          if(_.isArray(condition)) {
            condition = _.join(condition, ' OR ');
          }

          condition = ' ( ' + condition + ' ) ';

          this.conditions.push(condition);

          return this;
        };

        SoqlQueryBuilder.prototype.orderBy = function () {
          throw 'SoqlQueryBuilder orderBy not implemented';
        };

        SoqlQueryBuilder.prototype.limit = function () {
          throw 'SoqlQueryBuilder limit not implemented';
        };

        SoqlQueryBuilder.prototype.buildQuery = function () {
          var query = 'SELECT ';
          query += _.join(this.fields, ',');
          query += ' FROM ' + sobjectType;
          query += ' WHERE ' + _.join(this.conditions, ' AND ');
          return query;
        };

        SoqlQueryBuilder.prototype.execute = function () {
          var results = [];


          results.$pending = true;

          results.$promise = force.query(this.buildQuery()).then(function (result) {
            Array.prototype.push.apply(results, _.map(result.records, function (item) {
              return new SfResource(item);
            }));

            return results;
          }).finally(function () {
            results.$pending = false;
          });

          return results;
        };

        function SfResource(value) {
          shallowClearAndCopy(value || {}, this);
        };

        SfResource.get = function (id) {
          var result = new SfResource({});

          result.$pending = true;

          result.$promise = force.retrieve(sobjectType, id, null).then(function (res) {
            shallowClearAndCopy(res, result);
            return result;
          }).finally(function () {
            result.$pending = false;
          });

          return result;
        };

        SfResource.query = function (fields) {
          var queryBuilder = new SoqlQueryBuilder();

          queryBuilder.select(fields);

          return queryBuilder;
        };

        return SfResource;
      }

      return factory;
    }];
  }
];

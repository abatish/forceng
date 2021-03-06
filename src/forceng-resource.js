var _ = require('lodash');

module.exports = [
  function () {
    var provider = this;

    provider.$get = ['force', '$q', function (force, $q) {

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
          this.groupByFields = [];
          this.limitCount = null;
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

        SoqlQueryBuilder.prototype.groupBy = function (fields) {
          this.groupByFields = _.isArray(fields) ? fields : [fields];

          var idIndex = _.indexOf(this.fields, 'Id');
          if(idIndex > -1) {
            this.fields.splice(idIndex, 1);
          }

          return this;
        };

        SoqlQueryBuilder.prototype.orderBy = function (field, direction) {
          this.orderByField = field;
          this.orderByDirection = direction ? direction : 'ASC';
          return this;
        };

        SoqlQueryBuilder.prototype.limit = function (limit) {
          this.limitCount = limit;
          return this;
        };

        SoqlQueryBuilder.prototype.buildQuery = function () {
          var query = 'SELECT ';
          query += _.join(this.fields, ',');
          query += ' FROM ' + sobjectType;

          if(this.conditions && this.conditions.length > 0) {
            query += ' WHERE ' + _.join(this.conditions, ' AND ');
          }

          if(this.orderByField) {
            query += ' ORDER BY ' + this.orderByField + ' ' + this.orderByDirection;
          }

          if(this.groupByFields.length > 0) {
            query += ' GROUP BY ' + _.join(this.groupByFields, ',');
          }

          if(this.limitCount) {
            query += ' LIMIT ' + this.limitCount;
          }

          return query;
        };

        SoqlQueryBuilder.prototype.execute = function () {
          var value = [];

          value.$pending = true;

          value.$promise = force.query(this.buildQuery()).then(function (result) {
            Array.prototype.push.apply(value, _.map(result.records, function (item) {
              return new SfResource(item);
            }));
            return value;
          }).finally(function () {
            value.$pending = false;
          });

          return value;
        };

        function SfResource(value) {
          shallowClearAndCopy(value || {}, this);
        }

        SfResource.prototype.delete = function () {
          if(!this.isNew()) {
            return force.del(sobjectType, this.Id).then(function () {
              clearObjectCache();
            });
          }

          return $q.reject('cannot delete a new sf object');
        };

        SfResource.prototype.isNew = function () {
          return !this.id && !this.Id;
        };

        function clearObjectCache(regex) {
          regex = regex ? sobjectType + '.*' + regex : sobjectType;
          force.removeFromCacheByRegex(regex);
        }

        SfResource.prototype.save = function (updateFields) {
          var fields = {},
              obj = this,
              objCpy = angular.copy(obj);

          if(obj.isNew()) {
            updateFields = _.keys(obj);
          }

          _.forEach(updateFields, function(field) {
            fields[field] = obj[field];
          });

          if(!obj.isNew()) {
            promise = force.upsert({
              objectName: sobjectType,
              Id: obj.Id,
              fields: fields
            });
          } else {
            promise = force.create(sobjectType, fields);
          }

          return promise.then(function (resp) {
            clearObjectCache();
            return resp;
          });
        };

        SfResource.get = function (id) {
          var value = new SfResource({});

          value.$pending = true;

          value.$promise = force.retrieve(sobjectType, id, null).then(function (res) {
            var promise = value.$promise;
            shallowClearAndCopy(res, value);
            value.$promise = promise;
            return value;
          }).finally(function () {
            value.$pending = false;
          });


          return value;
        };

        SfResource.query = function (fields) {
          if(_.indexOf(fields, 'Id') < 0) {
            fields.push('Id');
          }

          var queryBuilder = new SoqlQueryBuilder();

          queryBuilder.select(fields);

          return queryBuilder;
        };

        SfResource.describe = function() {
          return force.describe(sobjectType);
        };

        SfResource.clearCache = function(regex) {
          clearObjectCache(regex);
        };

        return SfResource;
      }

      return factory;
    }];
  }
];

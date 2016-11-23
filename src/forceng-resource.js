var _ = require('lodash');

module.exports = [
  function () {
    var provider = this;

    provider.$get = ['force', '$q', function (force, $q) {

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
        };

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

        function clearObjectCache() {
          var cache = force.getCache();

          if(cache) {
            _.forEach(cache.keySet(), function (key) {
              // naivly assume all entries with the sObjectType are related
              // and need to be updated
              if(key.indexOf(sobjectType) >= 0) {
                cache.remove(key);
              }
            })
          }
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

          return promise.then(function () {
            clearObjectCache();
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

        return SfResource;
      }

      return factory;
    }];
  }
];

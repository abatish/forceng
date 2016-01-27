'use strict';

var app = require('angular').module('forceng', [])
  .factory('force', require('./force'))
  .provider('forceResource', require('./forceng-resource'));

module.exports = 'forceng';

'use strict';

require('angular-cache');

var app = require('angular').module('forceng', ['angular-cache'])
  .factory('force', require('./force'))
  .provider('forceResource', require('./forceng-resource'))
  .factory('chatterService', require('./chatter-service'));

module.exports = 'forceng';

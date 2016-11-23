var angular = require('angular');
var _ = require('lodash');
var uuid = require('node-uuid');
var sprintf = require('sprintf-js').sprintf;

module.exports = function ($rootScope, $q, $window, $http, $timeout, $interval, $rootScope, CacheFactory, $log) {
  // The login URL for the OAuth process
  // To override default, pass loginURL in init(props)
  var loginURL = 'https://login.salesforce.com',

  // whether or not the  init function was called; which is required
    initCalled = false,

  // The Connected App client Id.
    appId,

  // the cache instance, if any
    cache = null,

  // The force.com API version to use.
  // To override default, pass apiVersion in init(props)
    apiVersion = 'v33.0',

  // Keep track of OAuth data (access_token, refresh_token, and instance_url)
    oauth = {},

  // if page URL is http://localhost:3000/myapp/index.html, context is /myapp
    context,

  // if page URL is http://localhost:3000/myapp/index.html, serverURL is http://localhost:3000
    serverURL,

  // Only required when using REST APIs in an app hosted on your own server to avoid cross domain policy issues
  // To override default, pass proxyURL in init(props)
    proxyURL,

  // if page URL is http://localhost:3000/myapp/index.html, oauthCallbackURL is http://localhost:3000/myapp/oauthcallback.html
  // To override default, pass oauthCallbackURL in init(props)
    oauthCallbackURL = "http://localhost",

  // Because the OAuth login spans multiple processes, we need to keep the login success and error handlers as a variables
  // inside the module instead of keeping them local within the login function.
    deferredLogin,

  // Reference to the Salesforce OAuth plugin
    oauthPlugin,

    logger = $log;

  // Whether or not to use a CORS proxy. Defaults to false if app running in Cordova or in a VF page
  // Can be overriden in init()
  useProxy = proxyRequired() ? true : false;

  function getOauthInformation  () {
    return oauth;
  }

  /*
   * Determines the request base URL.
   */
  function getRequestBaseURL() {

    var url;

    if (useProxy) {
      url = proxyURL;
    } else if (oauth.instance_url) {
      url = oauth.instance_url;
    } else {
      url = serverURL;
    }

    // dev friendly API: Remove trailing '/' if any so url + path concat always works
    if (url.slice(-1) === '/') {
      url = url.slice(0, -1);
    }

    return url;
  }

  function parseQueryString(queryString) {
    var qs = decodeURIComponent(queryString),
      obj = {},
      params = qs.split('&');
    params.forEach(function (param) {
      var splitter = param.split('=');
      obj[splitter[0]] = splitter[1];
    });
    return obj;
  }

  function toQueryString(obj) {
    var parts = [],
      i;
    for (i in obj) {
      if (obj.hasOwnProperty(i)) {
        parts.push(encodeURIComponent(i) + "=" + encodeURIComponent(obj[i]));
      }
    }
    return parts.join("&");
  }


  function refreshTokenWithHTTPRequest(deferred) {
    var params = {
        'grant_type': 'refresh_token',
        'refresh_token': oauth.refresh_token,
        'client_id': appId
      },

      headers = {},

      url = useProxy ? proxyURL : loginURL;

    // dev friendly API: Remove trailing '/' if any so url + path concat always works
    if (url.slice(-1) === '/') {
      url = url.slice(0, -1);
    }

    url = url + '/services/oauth2/token?' + toQueryString(params);

    if (!useProxy) {
      headers["Target-URL"] = loginURL;
    }

    $http({
      headers: headers,
      method: 'POST',
      url: url,
      params: params
    })
      .then(function (resp) {
        oauth.access_token = resp.data.access_token;
        deferred.resolve();
      }, function (data, status, headers, config) {
        deferred.reject(data);
      });
  }

  function refreshToken() {
    var deferred = $q.defer();
    refreshTokenWithHTTPRequest(deferred);
    return deferred.promise;
  }

  /**
   * Initialize ForceNG
   * @param params
   *  appId (optional)
   *  loginURL (optional)
   *  proxyURL (optional)
   *  oauthCallbackURL (optional)
   *  apiVersion (optional)
   *  accessToken (optional)
   *  instanceURL (optional)
   *  refreshToken (optional)
   */
  function init(params) {
    initCalled = true;

    params = params || {};

    appId = params.appId || appId;

    //ignore the oauthCallbackUrl in Cordova
    oauthCallbackURL = params.oauthCallbackURL || oauthCallbackURL;

    apiVersion = params.apiVersion || apiVersion;
    loginURL = params.loginURL || loginURL;
    proxyURL = params.proxyURL || proxyURL;
    useProxy = params.useProxy === undefined ? useProxy : params.useProxy;

    if(params.caching) {
      if (!CacheFactory.get('forceNgCache')) {
        cache = CacheFactory('forceNgCache', {
          maxAge: 60000,
          deleteOnExpire: 'aggressive',
          storageMode: 'localStorage'
        });
      }
    }

    if (params.oauth) {
      for(var prop in params.oauth) {
        oauth[prop] = params.oauth[prop];
      }
    }

  }

  function logout() {
    for(var p in oauth) {
      delete oauth[p];
    }

    $rootScope.$emit('$forceLogout');
  }

  /**
   * Discard the OAuth access_token. Use this function to test the refresh token workflow.
   */
  function discardToken() {
    delete oauth.access_token;
  }

  function proxyRequired() {
    return !angular.isDefined($window.cordova) && !angular.isDefined($window.SfdcApp);
  }

  function isCordova() {
    return angular.isDefined($window.cordova);
  }

  /**
   * Login to Salesforce using OAuth. If running in a Browser, the OAuth workflow happens in a a popup window.
   */
  function login() {
    deferredLogin = $q.defer();
    if(!initCalled) {
      deferredLogin.reject('you must call init before login');
    } else {
      openOauthLogin(deferredLogin);
    }
    return deferredLogin.promise;
  }

  function getAuthorizeUrl() {
    return loginURL + '/services/oauth2/authorize' +
      '?display=touch' +
      '&response_type=token&client_id=' + appId+
      '&redirect_uri=' + oauthCallbackURL;
  };

  function handleOauthRedirect(url, browserRef, deferred, interval) {
    if(url && _.startsWith(url, oauthCallbackURL)) {
      var oauthResponse = parseQueryString((url).split('#')[1]);

      if (typeof oauthResponse === 'undefined' ||
        typeof oauthResponse.access_token === 'undefined') {
        deferred.reject("Problem authenticating");
      } else {
        _.extend(oauth, oauthResponse);
        deferred.resolve(oauthResponse);
      }

      if(interval) {
        $interval.cancel(interval);
      }

      $timeout(function () {
        browserRef.close();
      }, 10)

      return true;
    }

    return false;
  }

  function openOauthLogin(deferred) {

    if(isCordova() && !$window.cordova.InAppBrowser) {
      return deferred.reject('cordova-plugin-inappbrowser is required to run forceNg');
    }

    var browserRef = $window.open(getAuthorizeUrl(), "_blank", "location=no,clearsessioncache=yes,clearcache=yes");

    if(isCordova()) {
      browserRef.addEventListener("loadstart", function(event) {
        handleOauthRedirect(event.url, browserRef, deferred);
      });
      browserRef.addEventListener("loaderror", function(event) {
        handleOauthRedirect(event.url, browserRef, deferred);
      });
      browserRef.addEventListener("loadstop", function(event) {
        handleOauthRedirect(event.url, browserRef, deferred);
      });
    } else {
      var oauthHandled = false;

      // this is very hacky; but I way less like having a random HTML file being hosted
      // just for dev. this interval should be short enough that it will reliabliy catch
      // the params
      var interval = $interval(function () {
        try {
          if(!browserRef.window) {

            $interval.cancel(interval);

            if(!oauthHandled) {
              deferred.reject('login flow was cancelled by user');
            }

            return;
          }

          oauthHandled = handleOauthRedirect(browserRef.location.href, browserRef, deferred, interval);

        } catch (e) { }
      }, 10);
    }


  }

  /**
   * Gets the user's ID (if logged in)
   * @returns {string} | undefined
   */
  function getUserId() {
    return (typeof(oauth) !== 'undefined' && !!oauth.id) ? oauth.id.split('/').pop() : undefined;
  }

  /**
   * Check the login status
   * @returns {boolean}
   */
  function isAuthenticated() {
    return (oauth && oauth.access_token) ? true : false;
  }

  function handleUnauthorizedRequest(requestObj, deferred) {
    if(oauth.refresh_token) {
      refreshToken().then(function () {


        logger.debug({
          userId: getUserId(),
          msg: 'Refreshed access token'
        });

        $rootScope.$emit('$forceOauthUpdate');
        request(requestObj, deferred); // repeat the process; passing in our promise
      }, function (err) {

        logger.debug({
          userId: getUserId(),
          msg: 'Failed to refresh token',
          resp: err.data
        })

        logout();
        deferred.reject();
      });
    } else {
      logout();
      deferred.reject();
    }
  }

  function defaultHeaders () {
    return {
      'Authorization': 'Bearer ' + oauth.access_token
    };
  }


  /**
   * Lets you make any Salesforce REST API request.
   * @param obj - Request configuration object. Can include:
   *  method:  HTTP method: GET, POST, etc. Optional - Default is 'GET'
   *  path:    path in to the Salesforce endpoint - Required
   *  params:  queryString parameters as a map - Optional
   *  data:  JSON object to send in the request body - Optional
   */
  function request(obj, deferred) {

    var method = obj.method || 'GET',
      headers = defaultHeaders(),
      url = getRequestBaseURL(),
      deferred = deferred || $q.defer();


    obj.settings = obj.settings || {};

    if(!initCalled) {
      deferred.reject('you must call init before making any requests');
    } else {
      if (!oauth || (!oauth.access_token && !oauth.refresh_token)) {
        deferred.reject('No access token. Login and try again.');
        return deferred.promise;
      }

      // dev friendly API: Add leading '/' if missing so url + path concat always works
      if (obj.path.charAt(0) !== '/') {
        obj.path = '/' + obj.path;
      }

      url = url + obj.path;

      if (obj.contentType) {
        headers["Content-Type"] = obj.contentType;
      }
      if (useProxy) {
        headers["Target-URL"] = oauth.instance_url;
      }

      var opts = _.defaults(obj.settings, {
        headers: headers,
        method: method,
        url: url,
        params: obj.params,
        data: angular.copy(obj.data),
        cache: getCache()
      });

      var reqId = uuid.v4();

      logger.debug({
        uuid: reqId,
        userId: getUserId(),
        endpoint: url,
        params: obj.params,
        data: opts.data
      });

      $http(opts)
        .then(function (resp) {

          logger.debug({
            uuid: reqId,
            result: 'success'
          });

          deferred.resolve(resp.data);
        }, function (resp) {

          logger.debug({
            uuid: reqId,
            result: 'failed',
            response: resp.data,
            status: resp.status
          });

          if(getCache()) {
            getCache().remove(url); // don't cache failed requests
          }

          if (resp.status === 401) {
            delete obj.settings.headers;
            handleUnauthorizedRequest(obj, deferred);
          }
          else {
            deferred.reject(resp.data);
          }
        });
    }

    return deferred.promise;
  }

  /**
   * Execute SOQL query
   * @param soql
   * @returns {*}
   */
  function query(soql) {
    return request({
      path: '/services/data/' + apiVersion + '/query',
      params: {q: soql}
    });

  }

  /**
   * Retrieve a record based on its Id
   * @param objectName
   * @param id
   * @param fields
   * @returns {*}
   */
  function retrieve(objectName, id, fields) {

    return request({
      path: '/services/data/' + apiVersion + '/sobjects/' + objectName + '/' + id,
      params: fields ? {fields: fields} : undefined
    });

  }

  /**
   * Create a record
   * @param objectName
   * @param data
   * @returns {*}
   */
  function create(objectName, data) {

    return request({
      method: 'POST',
      contentType: 'application/json',
      path: '/services/data/' + apiVersion + '/sobjects/' + objectName + '/',
      data: data
    });

  }

  /**
   * Update a record
   * @param objectName
   * @param data
   * @returns {*}
   */
  function update(objectName, data) {

    var id = data.Id,
      fields = angular.copy(data);

    delete fields.attributes;
    delete fields.Id;

    return request({
      method: 'POST',
      contentType: 'application/json',
      path: '/services/data/' + apiVersion + '/sobjects/' + objectName + '/' + id,
      params: {'_HttpMethod': 'PATCH'},
      data: fields
    });

  }

  /**
   * Delete a record
   * @param objectName
   * @param id
   * @returns {*}
   */
  function del(objectName, id) {

    return request({
      method: 'DELETE',
      path: '/services/data/' + apiVersion + '/sobjects/' + objectName + '/' + id
    });

  }

  /**
   * Upsert a record
   * @param objectName
   * @param externalIdField
   * @param externalId
   * @param data
   * @returns {*}
   */
  function upsert(params) {
    var objectName = params.objectName,
        id = params.Id,
        fields = params.fields;


    return request({
      method: 'PATCH',
      contentType: 'application/json',
      path: '/services/data/' + apiVersion + '/sobjects/' + objectName + (id ? '/' + id : ''),
      data: fields
    });

  }

  /**
   * Convenience function to invoke APEX REST endpoints
   * @param pathOrParams
   * @param successHandler
   * @param errorHandler
   */
  function apexrest(pathOrParams) {

    var params;

    if (pathOrParams.substring) {
      params = {path: pathOrParams};
    } else {
      params = pathOrParams;

      if (params.path.charAt(0) !== "/") {
        params.path = "/" + params.path;
      }

      if (params.path.substr(0, 18) !== "/services/apexrest") {
        params.path = "/services/apexrest" + params.path;
      }
    }

    return request(params);
  }

  /**
   * Convenience function to invoke the Chatter API
   * @param params
   * @param successHandler
   * @param errorHandler
   */
  function chatter(params) {
    if (!params || (!params.path && !params.fullPath)) {
      errorHandler("You must specify a path for the request");
      return;
    }

    if(params.fullPath) {
      params.path = params.fullPath;
    } else {

      var base = "/services/data/" + apiVersion + (params.path.indexOf('chatter') >= 0 ? '' : '/chatter');

      if (params.path.charAt(0) !== "/") {
        params.path = "/" + params.path;
      }

      params.path = base + params.path;
    }

    return request(params);

  }

  /**
   * Retrieve metadata for an object
   * @param objectName
   * @returns {*}
   */
  function describe(objectName) {

    return request({
      path: '/services/data/' + apiVersion + '/sobjects/' + objectName + '/describe'
    });

  }

  function getCache() {
    return cache;
  }

  function removeFromCacheByRegex(regex) {
    var cache = getCache();
    if(cache) {
      var keys = _.filter(cache.keySet(), function (key) {
        return key.match(regex);
      });

      _.forEach(keys, function(key) {
        cache.remove(key);
      });
    }
  }

  // The public API
  return {
    init: init,
    login: login,
    getUserId: getUserId,
    isAuthenticated: isAuthenticated,
    request: request,
    query: query,
    create: create,
    update: update,
    del: del,
    upsert: upsert,
    retrieve: retrieve,
    apexrest: apexrest,
    describe: describe,
    chatter: chatter,
    oauth: oauth,
    logout: logout,
    getCache: getCache,
    removeFromCacheByRegex: removeFromCacheByRegex
  };

};

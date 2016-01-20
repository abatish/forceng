var angular = require('angular');

module.exports = function ($rootScope, $q, $window, $http) {
  // The login URL for the OAuth process
  // To override default, pass loginURL in init(props)
  var loginURL = 'https://login.salesforce.com',

  // whether or not the  init function was called; which is required
    initCalled = false,

  // The Connected App client Id.
    appId,

  // The force.com API version to use.
  // To override default, pass apiVersion in init(props)
    apiVersion = 'v33.0',

  // Keep track of OAuth data (access_token, refresh_token, and instance_url)
    oauth,

  // By default we store fbtoken in sessionStorage. This can be overridden in init()
    tokenStore = {},

  // if page URL is http://localhost:3000/myapp/index.html, context is /myapp
    context,

  // if page URL is http://localhost:3000/myapp/index.html, serverURL is http://localhost:3000
    serverURL,

  // Only required when using REST APIs in an app hosted on your own server to avoid cross domain policy issues
  // To override default, pass proxyURL in init(props)
    proxyURL,

  // if page URL is http://localhost:3000/myapp/index.html, oauthCallbackURL is http://localhost:3000/myapp/oauthcallback.html
  // To override default, pass oauthCallbackURL in init(props)
    oauthCallbackURL,

  // Because the OAuth login spans multiple processes, we need to keep the login success and error handlers as a variables
  // inside the module instead of keeping them local within the login function.
    deferredLogin,

  // Reference to the Salesforce OAuth plugin
    oauthPlugin,

  // Whether or not to use a CORS proxy. Defaults to false if app running in Cordova or in a VF page
  // Can be overriden in init()
  useProxy = proxyRequired() ? true : false;

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

  function refreshTokenWithPlugin(deferred) {
    oauthPlugin.authenticate(
      function (response) {
        oauth.access_token = response.accessToken;
        tokenStore.forceOAuth = JSON.stringify(oauth);
        deferred.resolve();
      },
      function () {
        console.log('Error refreshing oauth access token using the oauth plugin');
        deferred.reject();
      });
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
      .success(function (data, status, headers, config) {
        console.log('Token refreshed');
        oauth.access_token = data.access_token;
        tokenStore.forceOAuth = JSON.stringify(oauth);
        deferred.resolve();
      })
      .error(function (data, status, headers, config) {
        console.log('Error while trying to refresh token');
        deferred.reject();
      });
  }

  function refreshToken() {
    var deferred = $q.defer();
    if (oauthPlugin) {
      refreshTokenWithPlugin(deferred);
    } else {
      refreshTokenWithHTTPRequest(deferred);
    }
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

    if(!params.appId) {
      throw 'forceng appId is required on init';
    }

    if(!params.oauthCallbackURL) {
      throw 'forceng oauthCallbackURL is requried on init';
    }

    appId = params.appId;
    oauthCallbackURL = params.oauthCallbackURL;

    apiVersion = params.apiVersion || apiVersion;
    loginURL = params.loginURL || loginURL;
    proxyURL = params.proxyURL || proxyURL;
    useProxy = params.useProxy === undefined ? useProxy : params.useProxy;

    if (params.accessToken) {
      if (!oauth) oauth = {};
      oauth.access_token = params.accessToken;
    }

    if (params.instanceURL) {
      if (!oauth) oauth = {};
      oauth.instance_url = params.instanceURL;
    }

    if (params.refreshToken) {
      if (!oauth) oauth = {};
      oauth.refresh_token = params.refreshToken;
    }

  }

  /**
   * Discard the OAuth access_token. Use this function to test the refresh token workflow.
   */
  function discardToken() {
    delete oauth.access_token;
    tokenStore.forceOAuth = JSON.stringify(oauth);
  }

  /**
   * Called internally either by oauthcallback.html (when the app is running the browser)
   * @param url - The oauthCallbackURL called by Salesforce at the end of the OAuth workflow. Includes the access_token in the querystring
   */
  function oauthCallback(url) {

    // Parse the OAuth data received from Facebook
    var queryString,
      obj;

    if (url.indexOf("access_token=") > 0) {
      queryString = url.substr(url.indexOf('#') + 1);
      obj = parseQueryString(queryString);
      oauth = obj;
      tokenStore['forceOAuth'] = JSON.stringify(oauth);
      if (deferredLogin) deferredLogin.resolve();
    } else if (url.indexOf("error=") > 0) {
      queryString = decodeURIComponent(url.substring(url.indexOf('?') + 1));
      obj = parseQueryString(queryString);
      if (deferredLogin) deferredLogin.reject(obj);
    } else {
      if (deferredLogin) deferredLogin.reject({status: 'access_denied'});
    }
  }

  function proxyRequired() {
    return (window.cordova || window.SfdcApp);
  }

  /**
   * Login to Salesforce using OAuth. If running in a Browser, the OAuth workflow happens in a a popup window.
   */
  function login() {
    if(!initCalled) {
      throw 'init must be called before a login is attempted';
    }

    deferredLogin = $q.defer();
    if (!proxyRequired()) {
      loginWithPlugin();
    } else {
      loginWithBrowser();
    }
    return deferredLogin.promise;
  }

  function loginWithPlugin() {
    document.addEventListener("deviceready", function () {
      oauthPlugin = cordova.require("com.salesforce.plugin.oauth");
      if (!oauthPlugin) {
        console.error('Salesforce Mobile SDK OAuth plugin not available');
        if (deferredLogin) deferredLogin.reject({status: 'Salesforce Mobile SDK OAuth plugin not available'});
        return;
      }
      oauthPlugin.getAuthCredentials(
        function (creds) {
          // Initialize ForceJS
          init({accessToken: creds.accessToken, instanceURL: creds.instanceUrl, refreshToken: creds.refreshToken});
          if (deferredLogin) deferredLogin.resolve();
        },
        function (error) {
          if (deferredLogin) deferredLogin.reject(error);
        }
      );
    }, false);
  }

  function loginWithBrowser() {
    var loginWindowURL = loginURL + '/services/oauth2/authorize?client_id=' + appId + '&redirect_uri=' + oauthCallbackURL + '&response_type=token';
    window.open(loginWindowURL, '_blank', 'location=no');
  }

  /**
   * Gets the user's ID (if logged in)
   * @returns {string} | undefined
   */
  function getUserId() {
    return (typeof(oauth) !== 'undefined') ? oauth.id.split('/').pop() : undefined;
  }

  /**
   * Check the login status
   * @returns {boolean}
   */
  function isAuthenticated() {
    return (oauth && oauth.access_token) ? true : false;
  }

  /**
   * Lets you make any Salesforce REST API request.
   * @param obj - Request configuration object. Can include:
   *  method:  HTTP method: GET, POST, etc. Optional - Default is 'GET'
   *  path:    path in to the Salesforce endpoint - Required
   *  params:  queryString parameters as a map - Optional
   *  data:  JSON object to send in the request body - Optional
   */
  function request(obj) {

    if(!initCalled) {
      throw 'ForceNG init was not called; you must call init before making requests';
    }

    var method = obj.method || 'GET',
      headers = {},
      url = getRequestBaseURL(),
      deferred = $q.defer();

    if (!oauth || (!oauth.access_token && !oauth.refresh_token)) {
      deferred.reject('No access token. Login and try again.');
      return deferred.promise;
    }

    // dev friendly API: Add leading '/' if missing so url + path concat always works
    if (obj.path.charAt(0) !== '/') {
      obj.path = '/' + obj.path;
    }

    url = url + obj.path;

    headers["Authorization"] = "Bearer " + oauth.access_token;
    if (obj.contentType) {
      headers["Content-Type"] = obj.contentType;
    }
    if (useProxy) {
      headers["Target-URL"] = oauth.instance_url;
    }

    $http({
      headers: headers,
      method: method,
      url: url,
      params: obj.params,
      data: obj.data
    })
      .success(function (data, status, headers, config) {
        deferred.resolve(data);
      })
      .error(function (data, status, headers, config) {
        if (status === 401 && oauth.refresh_token) {
          refreshToken()
            .success(function () {
              // Try again with the new token
              request(obj);
            })
            .error(function () {
              console.error(data);
              deferred.reject(data);
            });
        } else {
          console.error(data);
          deferred.reject(data);
        }

      });

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
  function upsert(objectName, externalIdField, externalId, data) {

    return request({
      method: 'PATCH',
      contentType: 'application/json',
      path: '/services/data/' + apiVersion + '/sobjects/' + objectName + '/' + externalIdField + '/' + externalId,
      data: data
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

    var base = "/services/data/" + apiVersion + "/chatter";

    if (!params || !params.path) {
      errorHandler("You must specify a path for the request");
      return;
    }

    if (params.path.charAt(0) !== "/") {
      params.path = "/" + params.path;
    }

    params.path = base + params.path;

    return request(params);

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
    chatter: chatter,
    discardToken: discardToken,
    oauthCallback: oauthCallback
  };

};

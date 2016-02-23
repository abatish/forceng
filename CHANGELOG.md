# 1.0.1
- initial release forked from ccoenraets/forceng

# 1.1.0
- added forceng-resource (only query and get)

# 1.1.3
- throwing away oauth if the refresh token call fails

# 1.1.5
- added ability to re-init user id
- added check that id was set before checking it

# 1.1.6
- added query building support for forceng resource

# 1.1.9
- preserving $promise on get and query when value returend

# 1.1.12
- updated request/requestToken/tokenUpdate flows to emit events,
  actually clean out token

# 1.1.14
- updated handleOauthRedirect to use lodash's starts with instead of
  String.startsWith, which isn't always supported.

# 1.2.0
- changed way login can be resotred; now user is expected
  to pass oauth as a param to the init funciton

# 1.2.1
- added ability to pass a fullPath param to chatter to bypass the
  path appending.

# 1.2.2
- added ability to override $http params to request via the "settings" param

# 1.2.3
- added naive way to cache; chatterService

# 1.2.7
- no longer caching failed requsts.

# 1.2.8
- logging

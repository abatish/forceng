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

# 1.3.3
- Added passToken parameter to chatterService.getAcatarUrl to optionally
  not pass the oauth_token param.
- Added chatterService.resetCommentsCache() method

# 1.3.4
- Added chatterService.getMentionCompletions() method
- Added ability to pass messageSegments to createPost/createComment to allow
  saving at mentions

# 1.3.5
- Added groupBy support to forceng-resource

# 1.3.6
- Added limit support to forceng-resource

# 1.3.7
- Add methods for describe endpoint

# 1.3.8
- Fix chatterService.recordFeedUrl() to user given record ID

# 1.3.9
- Add orderBy support to forceng-resource
- Make where method optional on forceng-resource

# 1.3.10
- Add chatterService.uploadUserPhoto() method

# 1.3.11
- Add clearCache() method to SfResource to clear cache with optional regex

# 1.3.12
- Add chatterService.flagPost() and chatterService.unflagPost()

# 1.3.13
- Bump default api version to 38.0

# 1.3.14
- Fix user photo upload request for API version 35.0+

# 1.3.15
- Add force.processApproval() method

# 1.3.16
- Add chatterService.retriveLikes() and resetLikesCache() methods

# 1.3.17
- Remove toolbar from oauth popup on iOS

# 1.3.18
- Add chatterService.resetUserProfileCache() method

# 1.3.19
- Add cache busting to all requests

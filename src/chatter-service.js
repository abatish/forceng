'use strict';

module.exports = [
  'force', '$q', 'CacheFactory',

  function ( force, $q, CacheFactory ) {

    var communityId = null;

    function setCommunityId(newCommunityId) {
      communityId = newCommunityId;
    }

    function recordFeedUrl(recordId) {
      return baseChatterUrl() + '/feeds/record/' + recordId + '/feed-elements';
    }

    function baseChatterUrl() {
      return (communityId ? ('/connect/communities/' + communityId) : '') + '/chatter';
    }

    function getUserProfile(userId) {
      var path = baseChatterUrl() + '/users/' + userId;
      return force.chatter({ path: path });
    }

    function resetUserProfileCache(userId) {
      force.removeFromCacheByRegex(baseChatterUrl() + '/users/' + userId);
    }

    function getAvatarUrl(params) {
      return getUserProfile(params.userId)
        .then(function (profile) {
          var url = profile.photo[params.photoField || 'largePhotoUrl'];
          var query = params.passToken === false ? '' : '?oauth_token=' + force.oauth.access_token;
          return url + query;
        });
    }

    function getPostsForRecord(params) {
      var path = recordFeedUrl(params.recordId);

      if(params.query) {
        path += ('?q=' + params.query);
      }

      return force.chatter({ path: path });
    }

    function resetRecordFeedCache(recordId) {
      force.removeFromCacheByRegex(recordFeedUrl(recordId));
    }

    function deletePost(post) {
      var path = baseChatterUrl() + '/feed-elements/' + post.id;
      return force.chatter({ path: path, method: 'DELETE' }).then(function () {
        resetRecordFeedCache(post.parent.id);
      });
    }

    function createPost(params) {
      var path = baseChatterUrl() + '/feed-elements';

      var data = {
        feedElementType : "FeedItem",
        subjectId : params.subjectId
      };

      if(params.messageSegments) {
        data.body = {
          messageSegments: params.messageSegments
        }
      }
      else if(params.message) {
        data.body = {
          messageSegments: [
            { text: params.message, type: "Text" }
          ]
        };
      }

      return force.chatter({ path: path, data: data, method: 'POST' });
    }

    function createComment(params){
      var path = baseChatterUrl() + '/feed-elements/' + params.postId + '/capabilities/comments/items';

      var data = {};

      if(params.messageSegments) {
        data.body = {
          messageSegments: params.messageSegments
        }
      }
      else if(params.message) {
        data.body = {
          messageSegments: [
            { text: params.message, type: "Text" }
          ]
        };
      }

      return force.chatter({ path: path, data: data, method: 'POST' });
    }

    function retrieveComments(post){
      var path = baseChatterUrl() + '/feed-elements/' + post.id + '/capabilities/comments/items';

      return force.chatter({ path: path });
    }

    function resetCommentsCache(post) {
      var path = baseChatterUrl() + '/feed-elements/' + post.id + '/capabilities/comments/items';
      force.removeFromCacheByRegex(path);
    }

    function deleteComment(comment) {
      var path = baseChatterUrl() + '/comments/' + comment.id;
      return force.chatter({ path: path, method: 'DELETE'})
    }

    function likePost(post) {
      var path = baseChatterUrl() + '/feed-elements/' + post.id + '/capabilities/chatter-likes/items';
      return force.chatter({ path: path, method: 'POST' })
    }

    function unlikePost(post) {
      var path = baseChatterUrl() + '/likes/' + post.capabilities.chatterLikes.myLike.id;
      return force.chatter({ path: path, method: 'DELETE'})
    }

    function retrieveLikes(post) {
      var path = baseChatterUrl() + '/feed-elements/' + post.id + '/capabilities/chatter-likes';
      return force.chatter({ path: path, method: 'GET'})
    }

    function resetLikesCache(post) {
      var path = baseChatterUrl() + '/feed-elements/' + post.id + '/capabilities/chatter-likes';
      force.removeFromCacheByRegex(path);
    }

    function flagPost(post, options) {
      var path = baseChatterUrl() + '/feed-elements/' + post.id + '/capabilities/moderation';
      return force.chatter({ path: path, method: 'POST', data: options });
    }

    function unflagPost(post) {
      var path = baseChatterUrl() + '/feed-elements/' + post.id + '/capabilities/moderation';
      return force.chatter({ path: path, method: 'DELETE' });
    }

    function getMentionCompletions(params) {
      var path = baseChatterUrl() + '/mentions/completions?q=' + params.q
        + (params.contextId ? '&contextId=' + params.contextId : '')
        + (params.page ? '&page=' + params.page : '')
        + (params.pageSize ? '&pageSize=' + params.pageSize : '')
        + (params.type ? '&type=' + params.type : '');

      return force.chatter({ path: path});
    }

    function uploadUserPhoto(userId, file) {
      var formData = new FormData();
      formData.append('fileUpload', file);

      return force.chatter({
        fullPath: force.getVersionPath() + '/connect/communities/' + communityId + '/user-profiles/' + userId + '/photo',
        method: 'POST',
        data: formData,
        contentType: undefined,
        settings: {
          transformRequest: angular.identity
        }
      }).then(function(resp) {
        force.removeFromCacheByRegex(baseChatterUrl() + '/users/' + userId);
        return resp;
      });
    }

    return {
      getUserProfile: getUserProfile,
      getPostsForRecord: getPostsForRecord,
      createPost: createPost,
      deletePost: deletePost,
      likePost: likePost,
      unlikePost: unlikePost,
      retrieveLikes: retrieveLikes,
      flagPost: flagPost,
      unflagPost: unflagPost,
      getAvatarUrl: getAvatarUrl,
      retrieveComments: retrieveComments,
      createComment: createComment,
      deleteComment: deleteComment,
      resetCommentsCache: resetCommentsCache,
      resetRecordFeedCache: resetRecordFeedCache,
      resetLikesCache: resetLikesCache,
      resetUserProfileCache: resetUserProfileCache,
      setCommunityId: setCommunityId,
      getMentionCompletions: getMentionCompletions,
      uploadUserPhoto: uploadUserPhoto
    }
  }
];

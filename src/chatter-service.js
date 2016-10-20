'use strict';

module.exports = [
  'force', '$q', 'CacheFactory',

  function ( force, $q, CacheFactory ) {

    var communityId = null;

    function setCommunityId(newCommunityId) {
      communityId = newCommunityId;
    }

    function recordFeedUrl() {
      return baseChatterUrl() + '/feeds/news/me/feed-elements';
    }

    function baseChatterUrl() {
      return (communityId ? ('/connect/communities/' + communityId) : '') + '/chatter';
    }

    function getUserProfile(userId) {
      var path = baseChatterUrl() + '/users/' + userId;
      return force.chatter({ path: path });
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
        body: {
          messageSegments: [
            { text: params.message, type: "Text" }
          ]
        },
        feedElementType : "FeedItem",
        subjectId : params.subjectId
      };

      return force.chatter({ path: path, data: data, method: 'POST' });
    }

    function createComment(params){
      var path = baseChatterUrl() + '/feed-elements/' + params.postId + '/capabilities/comments/items';

      var data = {
        body: {
          messageSegments: [
            { text: params.message,
              type: "Text"
            }
          ]
        }
      };

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

    return {
      getUserProfile: getUserProfile,
      getPostsForRecord: getPostsForRecord,
      likePost: likePost,
      createPost: createPost,
      deletePost: deletePost,
      unlikePost: unlikePost,
      getAvatarUrl: getAvatarUrl,
      retrieveComments: retrieveComments,
      createComment: createComment,
      deleteComment: deleteComment,
      resetCommentsCache: resetCommentsCache,
      resetRecordFeedCache: resetRecordFeedCache,
      setCommunityId: setCommunityId
    }
  }
];

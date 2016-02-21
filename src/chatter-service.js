'use strict';

module.exports = [
  'force', '$q', 'CacheFactory',

  function ( force, $q, CacheFactory ) {

    var communityId = null;

    var profileCache = CacheFactory('chatterProfileCache', {
      maxAge: 600000,
      storageMode: 'localStorage'
    });


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
      return force.chatter({ path: path, settings: { cache: profileCache }});
    }

    function getAvatarUrl(params) {
      return getUserProfile(params.userId)
        .then(function (profile) {
          return profile.photo[params.photoField || 'largePhotoUrl'] + '?oauth_token=' + force.oauth.access_token;
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
      var cache = force.getCache();

      if(cache) {
        var items = _.filter(cache.keySet(), function (key) {
          return key.indexOf(recordFeedUrl(recordId)) >= 0
        });

        _.forEach(items, function (item) {
          cache.remove(item);
        });
      }
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
      }

      return force.chatter({ path: path, data: data, method: 'POST' });
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
      likePost: likePost,
      unlikePost: unlikePost,
      getAvatarUrl: getAvatarUrl,
      resetRecordFeedCache: resetRecordFeedCache,
      setCommunityId: setCommunityId
    }
  }
]

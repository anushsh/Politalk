module.exports = {

  /**
   * Query a single post by post ID.
   * Arguments:
     - postId: ID of the post to fetch
   * Returns status:
     - 200: Works, returns post
     - 4001: DynamoDB error, returns err
  **/
  get_post: function(req, res) {
    //Query Dynamo
    Post.get(req.body.postId, function(err, post) {
      //Successful request:
      if(! err) {
        //Prepare the object to be sent to client.
        //ie remove author if post is anonymous
        post = post.get();
        var rpost = {
          postID: post.postID,
          title: post.title,
          content: post.content,
          agree: post.agree,
          topic: post.topic,
          createdAt: post.createdAt
        };
        if(!post.anon) {
          rpost.author = post.author;
        }

        //Send to client
        res.send({status: 200, post: rpost});
      }else{
        res.send({status: 4001, err: err});
      }
    });
  },

  /**
   * Query all posts written by a specific user.
   * Arguments:
   * - username: Can be empty, in which case the posts
                 of the user making the request will be retrieved
   * Returns: 200 (OK, Items: list of posts), 4001 (Error, err: error msg)
  **/
  posts_by: function(req, res) {
    //If no user specified, choose currently logged in user (requestor)
    var uid = 'username' in req.body ? req.body.username : req.userdata.username;
    //Query dynamoDB & order posts in descending timestamp
    Post.query(uid).usingIndex('userquery').descending().exec(function(err, data){
      if(!err) {
        //Prepare posts, ie remove author if post is anonymous & not written by requestor
        var returnData = {status: 200};
        returnData['Items'] = [];
        data['Items'].forEach(function(i){
          i = i.get();
          if(i.anon){
            delete i.author;
          }
          if(i.author != req.userdata.username && i.anon){
            return;
          }
          returnData.Items.push(i);
        });
        //Sort posts by popularity (= how many people agree)
        returnData['Items'].sort((a,b)=> b.agree - a.agree);
        //Send result
        res.send(returnData);
      }else{
        //Send error
        res.send({status: 4002, err: err});
      }
    });
  },

  /**
   * Sends the opinion-posts, tailored to the individual user
   * /!\ TODO /!\  At the moment, it just scans the posts and returns them newest first
   * Should be replaced by Spark-populated feed
   * Not commented much because simple & temporary
  **/
  query_posts: function(req, res) {
    // query posts based on user-data, ie interests, affiliation,
    if(!req.userdata.feed){
      req.userdata.feed = []
    }
    items = [];
    var loadNormal = function() {
      Post.scan().loadAll().exec(function(err, data){
        if(err) {
          res.send({status: 4001, err: err});
          return;
        }
        data["Items"].map(item=>item.attrs).sort(function(a, b) {
          return Date.parse(b.createdAt) - Date.parse(a.createdAt);
        }).forEach(p => items.push(p));
        res.send({status: 200, Items: items});
      });
    }
    if(req.userdata.feed.length > 0) {
      Post.getItems(req.userdata.feed, function(err, posts) {
        posts.forEach(p=>items.push(p.attrs));
        loadNormal();
      });
    }else{
      loadNormal();
    }
  },

  /**
   * Queries the comments of a post/user, ordered by rating. No pagination (yet)
   * Arguments:
     - commentsBy: either postId or userId
     - postId: post id to query by
     - userId: user Id to query by
   * Returns:
   *  status:
       403: Not logged in.
       4001: Specified query method unknown
       4002: DynamoDB query error
      Items: List of comments with all attributes, if anonymous author removed.
  **/
  query_comments: function(req, res) {
    //Callback function to prepare & send result from dynamo data.
    var callback = function(err, dta) {
      if(!err) {
        //Remove author if comment is anonymous
        var returnData = {status: 200};
        returnData['Items'] = [];
        dta['Items'].forEach(function(i){
          i = i.get();
          var obj = {
            'content': i['content'],
            'post': i.associatedPostID,
            'agree': i.agree,
            'own': i.userID==req.userdata.username
          };
          if(!i.anon){
            obj['user'] = i.userID;
          }
          if(method == 'userId' && i.userID != req.userdata.username && i.anon){
            return;
          }
          returnData.Items.push(obj);
        });
        //Sort comments by how many people agree
        returnData['Items'].sort((a,b)=> b.agree - a.agree);
        //Send result
        res.send(returnData);
      }else{
        //DynamoDB error
        res.send({status: 4002, err: err});
      }
    };
    //Query Dynamo differently based on commentsBy value
    var method = req.body.commentsBy;
    if(method == 'postId') {
      //Query comments attributed to a certain post
      var post = req.body.postId;
      Comment.query(post).descending().exec(callback)
    }else if(method == 'userId') {
      //Query comments written by a certain user
      var uid = 'userId' in req.body ? req.body.userId : req.userdata.username;
      Comment.query(uid).usingIndex('userquery').descending().exec(callback);
    }else{
      //commentsBy (query method) not well specified
      res.send({status: 4001, err: 'Wrong arguments'});
    }
  },


  /**
   * I CREATED A MONSTER HERE BUT ITS 5AM I CANT THINK ANYMORE
   * /!\ Not commented for ugliness reasons, will be commented once refactored /!\
  **/
  vote_content: function(req, res) {
    var contentType = req.body.contentType.toLowerCase();
    var contentKey = req.body.contentKey;
    var upvote = req.body.vote >= 0;

    if(! req.userdata.agrees){
      req.userdata.agrees = [];
    }
    if(! req.userdata.disagrees) {
      req.userdata.disagrees = [];
    }

    if(upvote && req.userdata.agrees.includes(contentKey)){
      //DONE
      res.send({status:400});
      return;
    }else if(upvote && req.userdata.disagrees.includes(contentKey)){
      //DELETE, THEN ADD
      User.update({username: req.userdata.username, disagrees: {$del: contentKey}}, function(err, d){
        console.log(err);
      });
      User.update({username: req.userdata.username, agrees: {$add: contentKey}}, function(err, dat){console.log(err);});
      if(contentType == 'comment'){
        Comment.update({
          associatedPostID: contentKey.associatedPostID,
          createdAt: contentKey.createdAt,
          agree: {$add: 2}
        });
      }else{
        Post.update({postID: contentKey, agree: {$add: 2}});
      }
    }else if(upvote) {
      //ADD
      User.update({username: req.userdata.username, agrees: {$add: contentKey}}, function(err, dat){console.log(err);});
      if(contentType == 'comment'){
        Comment.update({
          associatedPostID: contentKey.associatedPostID,
          createdAt: contentKey.createdAt,
          agree: {$add: 1}
        });
      }else{
        Post.update({postID: contentKey, agree: {$add: 1}});
      }
    }else if(!upvote && req.userdata.disagrees.includes(contentKey)){
      //DONE
      res.send({status:400});
      return;
    }else if(!upvote && req.userdata.agrees.includes(contentKey)){
      //DELETE, THEN ADD
      User.update({username: req.userdata.username, agrees: {$del: contentKey}}, function(dat){});
      User.update({username: req.userdata.username, disagrees: {$add: contentKey}}, function(dat){});
      if(contentType == 'comment'){
        Comment.update({
          associatedPostID: contentKey.associatedPostID,
          createdAt: contentKey.createdAt,
          agree: {$add: -2}
        });
      }else{
        Post.update({postID: contentKey, agree: {$add: -2}});
      }
    }else{
      //ADD
      User.update({username: req.userdata.username, disagrees: {$add: contentKey}}, function(dat){});
      if(contentType == 'comment'){
        Comment.update({
          associatedPostID: contentKey.associatedPostID,
          createdAt: contentKey.createdAt,
          agree: {$add: -1}
        });
      }else{
        Post.update({postID: contentKey, agree: {$add: -1}});
      }
    }
    res.send({status: 200}); //Its 5am I cant do proper error checking anymore sorry I need sleep please
  },

  /**
   * Creates a new post or comment associated to the user making the request.
   * Returns:
   *  Status:
       403: Not logged in
       200: Okay
       4001: Content-Type argument flawed (Not post or comment)
       4002: DynamoDB error creating comment
       4003: DynamoDB error creating post
   * TODO:
      Better validation of inputs:
       Qualitative: Too short to be meaningful, bad words (flame), etc
   *  Add to to-be-processed-by-hadoop queue (Could use dynamoDB streams for that)
       instead of letting Hadoop pull *all* posts every single time
       (better for performance and resource usage)
   **/
  create_content: function(req, res) {
    //Get all necessary inputs, possibly validate them and post-process them.
    var contentType = req.body.contentType;
    var content = req.body.content;
    var userID = req.userdata.username;

    //Query dynamoDB based on content type to be posted
    if(contentType == 'comment') {
      //Post ID the comment will be attributed to. It can obviously be tampered
      //with, however that does not matter: The comment will simply (a) never
      //appear, or (b) appear at some point for some other post, for which it
      //might not be relevant, but that does not matter.
      var post = req.body.postId;
      Comment.create({associatedPostID: post, userID: userID, content: content, agree: 0}, function(err, dta){
        //Send back response based on success of dynamodb query
        if(! err){
          res.send({status: 200});
        }else{
          res.send({status: 4002, err: err});
        }
      });
    }else if(contentType == 'post') {
      //Title and topics could possibly be validated against swearword-filters
      //However, other misuse doesn't matter. Unpopular or unexistent topics will
      //simply make the post less likely to "trend"/be relevant for other users.
      var title = req.body.title;
      var topics = req.body.topics;
      var anon = req.body.anon;
      Post.create({author: userID, title: title, content: content, agree: 0, topic: topics, anon: anon}, function(err, dta){
        //Send back response based on success of dynamodb query
        if(! err){
          res.send({status: 200});
        }else{
          res.send({status: 4003, err: err});
        }
      });
    }else{
      res.send({status: 4001});
    }
  }
}

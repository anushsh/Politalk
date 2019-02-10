var vogels = require('vogels');
var Joi = require('joi');
vogels.AWS.config.loadFromPath('./config.json');
var sha256 = require('js-sha256');

User = vogels.define('User', {
    hashKey: 'username',
    timestamps: true,
    schema: {
        username: Joi.string(),
        email: Joi.string().email(),
        password: Joi.string(),
        affiliation: Joi.string(),
        political_orientation: Joi.number(),
        friends: Joi.array().items(Joi.object().keys({
            username: Joi.string(),
            strength: Joi.string(),
            status: Joi.number()
            //0=sent request,1=received request, 2=are friends
        })),
        timestamp: Joi.number().default(Date.now(), "defaulttime"),
        interests: vogels.types.stringSet(),
        recommendations: vogels.types.stringSet(),
        feed: vogels.types.stringSet(),
        mood: Joi.string().default(" "),
        agrees: vogels.types.stringSet(),
        disagrees: vogels.types.stringSet()
    }
});

Post = vogels.define('Post', {
  hashKey: 'postID',
  timestamps: true,
  schema: {
    'postID': vogels.types.uuid(),
    'author': Joi.string(),
    'title': Joi.string(),
    'content': Joi.string(),
    'agree': Joi.number(),
    'topic': vogels.types.stringSet(),
    'anon': Joi.boolean()
  },
  indexes: [
    {hashKey: 'author', rangeKey: 'createdAt', name: 'userquery', type: 'global'}
  ]
});
Comment = vogels.define('Comment', {
  hashKey: 'associatedPostID',
  rangeKey: 'createdAt',
  timestamps: true,
  schema: {
    'associatedPostID': vogels.types.uuid(),
    'userID': Joi.string(),
    'content': Joi.string(),
    'agree': Joi.number(),
    'anon': Joi.boolean()
  },
  indexes: [
    {hashKey: 'userID', rangeKey: 'createdAt', name: 'userquery', type: 'global'}
  ]
});

Notification = vogels.define('Notification', {
  hashKey: 'forUser',
  rangeKey: 'createdAt',
  timestamps: true,
  schema: {
    'forUser': Joi.string(),
    'type': Joi.string(),
    'fromUser': Joi.string(),
    'update': Joi.string(),
    'read': Joi.boolean().default(false)
  },
  indexes: [
    {hashKey: 'fromUser', rangeKey: 'createdAt', name: 'from', type: 'global'}
  ]
});

var addNotif = function(from, foru, type, val, callback) {
  Notification.query(from).usingIndex('from').descending().loadAll().exec(function(err, data){
    if(! err){
      var deleteItems = [];
      data.Items.forEach(function(i){
        i = i.get();
        if(type == i.type && ! i.read) {
          deleteItems.push({forUser: i.forUser, createdAt: i.createdAt});
        }
      });
      var destroy = new Promise((resolve, reject) => {
        if(deleteItems.length > 0){
          var promises = []
          deleteItems.forEach(i => {
            promises.push(new Promise((a, b) => {
              Notification.destroy(i, function(err, d) {
                if(err){
                  b(err);
                }else{
                  a();
                }
              });
            }));
          });
          Promise.all(promises).then(()=>{resolve();});
        }else{
          resolve();
        }
      });
      destroy.then(function(result){
        //Add new item.
        Notification.create({forUser: foru, fromUser: from, type: type, update: val}, function(err, dta) {
          if(!err) {
            callback(true);
          }else{
            callback(false, err);
          }
        });
      }, function(err) {
        console.log(err);
      });
    }else{
    }
  });
};

var queryNotifs = function(user) {
  return new Promise((a,b) => {
    Notification.query(user).descending().exec(function(err, data){
      if(!err){
        var toReturn = data.Items.map(x => x.get());
        var toSetRead = toReturn.filter(a => !a.read);
        a(toReturn);
        toSetRead.forEach(i => {
          Notification.update({forUser: i.forUser, createdAt: i.createdAt, read: !i.read}, function(err, res){
            if(err){
              console.log(err);
            }
          });
        });
      }else{
        b(err);
      }
    });
  });
}

/*looks for a specific user in the User datatable and returns that user
If no user found, return null, otherwise return the password of the
username*/
var lookup = function(username, route_callbck) {
    User.get(username, function(err, data) {
        if (err || username === null || data === null) {
            route_callbck(null, "username does not exist");
        } else if (data.Items === null) {
            route_callbck(null, null);
        } else {
            route_callbck(data.attrs.password, null);
        }
    })
}

/*Simply creates a table on DynamoDB*/
var createTables = function(callback) {
    vogels.createTables(function(err) {
        if (err) {
            callback('Error creating tables: ' + err, null);
        } else {
            callback(null, 'Tables has been created');
        }
    });
};

/*Deletes the User table from Dynamo if it exists*/
var deleteUserTable = function(callback) {
    User.deleteTable(function(err) {
        if (err) {
            callback('error deleteing user table: ' + err, null);
        } else {
            callback(null, 'deleted user table successfully');
        }
    });
};

//Add a user to the user Table if this user does not already exist
var addUser = function(username, email, password, affiliation,
    political_orientation, friends, interests, callback) {
    User.get(username, function(err, data) {
        if (err) {
            callback(err, null);
        }
        if (data === null) {
            User.create({
                    username: username,
                    email: email,
                    password: sha256(password),
                    affiliation: affiliation,
                    political_orientation: political_orientation,
                    friends: friends,
                    interests: interests,
                    timestamp: Date.now(),
                },
                function(err, user) {
                    if (err) {
                        callback('error adding user: ' + username + '-' + err, null);
                    } else {
                        callback(null, "Created user: " + user.get('username'));
                    }
                }
            );
        } else {
            callback("-1", null);
        }
    })
};


var searchUsers = function(query, username, callback) {
  User.scan()
  .where('username').ne(username)
  .where('username').contains(query)
  .attributes(['username','friends'])
  .exec(callback);
}

var setTimestamp = function(username, callback) {
    User.update({
            username: username,
            timestamp: Date.now()
        },
        function(err, user) {
            if (err) {
                callback(err, null);
            } else {
                callback(null, user);
            }
        });
};

/*Queries the User datatable and returns the data attributes
for the specificed user*/
var getUserData = function(username, callback) {
    User.get(username, function(err, data) {
        if (err || username === null || data === null) {
            callback("User does not exist", null);
        } else if (data.Items === null) {
            callback("Items are null", null);
        } else {
            callback(null, data.attrs);
        }
    });
};

/* returns the friends of a user in the data table of the specified
*/
var getUserFriends = function(username, callback) {
  User.get(username, function(err, data) {
      if (err || username === null || data === null) {
          callback("User does not exist", null);
      } else if (data.Items === null) {
          callback("Items are null", null);
      } else {
          callback(null, data.attrs.friends);
      }
  })
}

/* returns the affiliation of the specified user by getting from the
User table*/
var getAffiliation = function(username, callback) {
  User.get(username, function(err, data) {
      if (err || username === null || data === null) {
          callback("User does not exist", null);
      } else if (data.Items === null) {
          callback("Items are null", null);
      } else {
          callback(null, data.attrs.affiliation);
      }
  })
}

/*
Appends an interest to the interest list of a specified user
*/
var addInterest = function(username, interest, callback) {
    User.update({
            username: username,
            interests: {
                $add: interest
            }
        },
        function(err, data) {
            if (err) {
                callback('error adding interest: ' + interest + '-' + err, null);
            } else {
                callback(null, "added interest " + interest);
            }
        });
};

/*
Deletes a specified interest from the user interest list of the specified
user
*/
var removeInterest = function(username, interest, callback) {
    User.update({
            username: username,
            interests: {
                $del: interest
            }
        },
        function(err, data) {
            if (err) {
                callback('error adding interest: ' + interest + '-' + err, null);
            } else {
                callback(null, "added interest " + interest);
            }
        });
};

/*
Changes the affiliation of a specified user in the User table
*/
var changeAffiliation = function(username, affiliation, callback) {
  User.update({
    username: username,
    affiliation: affiliation
  }, function(err, data){
    if (err){
      callback(err, null)
    } else {
      callback(null, "Affiliation changed!");
    }
  });
};

/*
Changes the password of a specified user in the User table
*/
var changePassword = function(username, newPassword, callback) {
  if (!(newPassword === "")){
  User.update({
    username: username,
    password: sha256(newPassword)
  }, function(err, data){
    if (err){
      callback(err, null)
    } else {
      callback(null, "Password changed!");
    }
  });
}
};

/*
Changes the political orientation of a specified user in the User table
*/
var changePolOrient = function(username, newPolOrient, callback) {
  User.update({
    username: username,
    political_orientation: newPolOrient
  }, function(err, data){
    if (err){
      callback(err, null)
    } else {
      callback(null, "Political orientation changed!");
    }
  });
};

/*
Changes the mood of a specified user in the User table
*/
var changeMood = function(username, newMood, callback) {
  User.update({
    username: username,
    mood: newMood
  }, function(err, data){
    if (err){
      callback(err, null)
    } else {
      callback(null, "Mood changed!");
    }
  });
};

/*
Adds a friend to the user friend list in the User table, making the status
0 or 1 depending on who sent the friend request and who received it. The
connection is bilaterally made, so both users appear on each other's
friend list
*/
var addFriend = function(username1, username2, status, callback){
  var params = {};
  params.UpdateExpression = 'SET friends = list_append(if_not_exists(friends, :empty_list), :friend)';
  params.ExpressionAttributeValues = {
      ':empty_list': [],
      ':friend': [{
          username: username2,
          strength: 'strong',
          status: status
      }]
  };
  User.update({username: username1}, params, function(err, data) {
      if (err) {
          callback('error adding friends: ' + username1 + '-' + err, null);
      } else {
          console.log("added friend " + username1);
          callback(null, "added friend " + username1);
      }
  });
};

/*
Goes into the friends list of each of the users and updates their status to
'2', signifying that they are now actually friends
*/
var becomeFriends = function(username1, username2, callback){
  getUserFriends(username1, function(err, data){
    if (err){
      callback(err, null);
    } else {
      var index = -1;
      for (var i = 0; i < data.length; i++){
        if (data[i].username == username2){
          index = i;
          console.log('index: ' + i);
        }
      }
      if (index === -1){
        callback("User had no friends", null);
      } else {
        var params = {};
        params.UpdateExpression = 'SET #frnd['+ index + '].#sts = :val';
        params.ExpressionAttributeNames = {
          '#frnd' : 'friends',
          '#sts' : 'status'
        };
        params.ExpressionAttributeValues = {
          ':val': 2
        };
        User.update({username: username1}, params, function(err, data) {
          if (err) {
            console.log(err);
            callback(err, null);
          } else {
            callback(null, "success for " + username1);
          }
        });
      }
    }
  });
};

/*
Removes a friend from the friend list of a user from the User table
*/
var removeFriend = function(username, friend, callback) {
  getUserFriends(username, function(err, data){
    if (err){
      callback(err, null);
    } else {
      var index = -1;
      for (var i = 0; i < data.length; i++){
        if (data[i].username == friend){
          index = i;
          console.log('index: ' + i);
        }
      }
      if (index === -1){
        callback("User had no friends", null);
      } else {
        var params = {};
        params.UpdateExpression = 'REMOVE #frnd['+ index + ']';
        params.ExpressionAttributeNames = {
          '#frnd' : 'friends',
        };
        User.update({username: username}, params, function(err, data) {
          if (err) {
            console.log(err);
            callback(err, null);
          } else {
            callback(null, "success for " + username);
          }
        });
      }
    }
  });
};

var database = {
    create_tables: createTables,
    delete_user_table: deleteUserTable,
    add_user: addUser,
    get_user_data: getUserData,
    lookup: lookup,
    add_int: addInterest,
    del_int: removeInterest,
    get_friends: getUserFriends,
    add_friend: addFriend,
    remove_friend: removeFriend,
    become_friends: becomeFriends,
    set_time: setTimestamp,
    search_users: searchUsers,
    change_affiliation: changeAffiliation,
    change_password: changePassword,
    change_pol_or: changePolOrient,
    change_mood: changeMood,
    get_affiliation: getAffiliation,
    add_notif: addNotif,
    get_notifs: queryNotifs
};

module.exports = database;

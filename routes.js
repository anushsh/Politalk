//Require all necessary models/database access points/modules
var db = require('../models/database.js');
var chat_db = require('../models/chat_db.js')
var sha256 = require('js-sha256');

/**
 * Display login page with message regarding potential input problems
**/
var main = function(req, res) {
  var messages = [];
  messages[0] = "Invalid password";
  messages[1] = "Invalid username & password";
  messages[2] = messages[1];
  messages[3] = messages[1];
  var message = messages[req.query.error] ? messages[req.query.error] : "";
  res.render('main.ejs', {message: message});
};

/**
 * Display signup page with potential error message
**/
var getSignup = function(req, res) {
    if (req.query.error == 4) {
        res.render('signup.ejs', {message: "User already exists"});
    } else if (req.query.error == 5) {
        res.render('signup.ejs', {message: "Please fill in all fields"});
    } else if (req.query.error == 6) {
        res.render('signup.ejs', {message: "Please fill orientation correctly"});
    } else {
        res.render('signup.ejs', {message: ""});
    }
};

/**
 * Checks if the user is logged in and if yes return user data
**/
var credential_check = function(req, callback){
  if(req.session.user){
	  db.get_user_data(req.session.user, function(err, data) {
      if (err) {
        callback(false, {});
      } else {
		    callback(true, data);
      }
    });
  }else{
    callback(false, {err: 'Failing cookie not set'});
  }
};

/* Checks the login credentials of the user and then redirects to
the chat page if credentials are valid
(For login page)
*/
var checkLogin = function(req, res) {
    var username = req.body.myInputField;
    var userPassword = req.body.password;
    if (username === "") {
      res.render('main.ejs', {
          message: "Invalid username & password"
      });
        if (userPassword === "") {
          res.render('main.ejs', {
              message: "Invalid username & password"
          });
        } else {
          res.render('main.ejs', {
              message: "Invalid username & password"
          });
        }
    } else {
        db.lookup(username, function(data, err) {
            if (err) {
                res.redirect("/?error=3");
            }
            if (data === null) {
                res.redirect("/?error=2");
            } else {
                var str = (data);
                if (str === sha256(userPassword)) {
                    req.session.user = username;
                    res.redirect("/");
                } else {
                  res.render('main.ejs', {
                      message: "Invalid username & password"
                  });
                }
            }
        });
    }
};

/*
Adds a user to the Dynamo database if all fields are filled out
*/
var addUser = function(req, res) {
    var userNewName = req.body.Inputholder;
    var userNewPassword = req.body.password;
    var email = req.body.email;
    var affiliation = req.body.affiliation;
    var political = parseInt(req.body.political);
    var friends = [];
    var interests = ['politics'];
    if (!(userNewName === "" || userNewPassword === "" || email === "" ||
            affiliation === "" || political === "" || interests === "")) {
              if ((Number.isInteger(political)) && political >= -10
              && political <= 10){
        db.add_user(userNewName, email, userNewPassword, affiliation,
            political, friends, interests,
            function(data, err) {
                console.log("What is love " + data);
                if (data == null) {
                    req.session.user = userNewName;
                    res.redirect("/");
                } else if (data == "-1") {
                    res.redirect("/signup/?error=4");
                } else if (err) {
                    console.log("error ocurred here");
                } else {
                    req.session.user = userNewName;
                    res.redirect("/");
                }
            });
          } else {
            res.redirect("/signup/?error=6");
          }
    } else {
        res.redirect("/signup/?error=5");
    }
};

//gets chat data from 2 users (post)
var loadChat = function(req, res) {
    var user1 = req.body.user1;
    var user2 = req.body.user2;
    chat_db.get_messages(user1, user2, function(err, data) {
        if (err) {
            res.send(err);
        } else {
            res.send(data);
        }
    });
};

/*
function that returns the user data defined in the user schema (post)
*/
var getUserData = function(req, res) {
    var username = req.body.username ? req.body.username : req.session.user;
    if (username === undefined) {
        res.status(404).send('User not found');
    } else {
        db.get_user_data(username, function(err, data) {
            if (err) {
                res.send({status: 4001, err: err});
            } else {
		            data.status = 200;
                res.send(data);
            }
        });
    }
};

//sends chat request to other user
var requestChat = function(res, res) {
    var from = req.body.user1;
    var to = req.body.user2;
    var chatroom = ''; //generate chatroom id for socket.io
    res.redirect('/chat/' + chatroom);
}

//loads chat html page (get)
var chat = function(req, res) {
    var username = req.session.user;
    db.get_user_data(username, function(err, data) {
        if (err) {
            console.log(err);
            res.status(500).send('Something broke!')
        } else {
            var friends = [];
            if (data["friends"]) {
                data["friends"].forEach(function(element) {
                    if (element.status === 2) {
                        friends.push(element.username);
                    }
                });
            }
            res.render('chat.ejs', {
                username: username,
                friends: friends
            });
        }
    });
}

//uploads chat message (post)
var sendMessage = function(req, res) {
    var from = req.body.from;
    var to = req.body.to;
    var message = req.body.message;
    chat_db.send_message(from, to, message, function(err, data) {
        if (err) {
            res.send(err);
        } else {
            res.send(data);
        }
    });
};

//searches for all users matching query
var userSearch = function(req, res) {
  var username = req.session.user;
  var query = req.body.query;
  db.search_users(query, username, function(err, data) {
    if (err) {
      console.log(err);
      res.send(500);
    } else {
      var items = data.Items;
      var filtered = items.filter(function(elem) {
        return {username: elem.username};
      });
      res.send(filtered);
    }
  });
}

//gets last ping from user table
var getTime = function(req, res) {
    var user = req.body.user;
    db.get_user_data(user, function(err, data) {
        if (err) {
            console.log(err);
            res.status(500).send('Something broke!')
        } else {
            var time = data.timestamp;
            res.json(time);
        }
    });
};

//gets the friend statusNumber when given userData
var statusNumber = function(userdata, other) {
  var friends = userdata.friends;
  var found = false;
  if (friends) {
    for (var i = 0; i < friends.length; i++) {
      if (friends[i].username == other) {
        return friends[i].status;
      }
    }
    return -1;
  } else {
    return -1;
  }
}

//gets last ping from user table
var setTime = function(req, res) {
    var user = req.session.user;
    db.set_time(user, function(err, data) {
        if (err) {
            console.log(err);
        } else {
            console.log(data.attrs.timestamp);
            res.json(data.attrs.timestamp);
        }
    });
};

//logout get request
var getLogout = function(req, res) {
    req.session.destroy();
    res.redirect('/');
};

//sets username
var setUsername = function(req, res) {
    var name = req.body.name;
    req.session.user = name;
    res.send(name);
}

//adds interest
var addInt = function(req, res) {
  var user = req.session.user;
  var interest = req.body.interest;
  db.add_int(user, interest, function(err, data) {
    if (err){
      console.log(err);
      res.send(err);
    } else {
      console.log("Interest added")
      res.send({status: 200});
    }
  });
};

//deletes interest
var delInt = function(req, res) {
  var user = req.userdata.username;
  var interest = req.body.interest;
  db.del_int(user, interest, function(err, data) {
    if (err){
      console.log(err);
      res.send(err);
    } else {
      console.log("Interest deleted");
      res.send({status: 200});
    }
  });
};

//changes mood (status)
//(sends notification to all friends)
var changeMood = function(req, res) {
   var user = req.userdata.username;
   var mood = req.body.mood;
   db.change_mood(user, mood, function(err, data) {
     if (err) {
       console.log(err);
       res.send(err);
     } else {
       //If user has no friends set a dummy empty array to not cause a crash
       if(! req.userdata.friends) {
         req.userdata.friends = []
       };
       req.userdata.friends.filter(x => x.status == 2).forEach(f => {
         db.add_notif(user, f.username, 'm', mood, function(success,error){
         });
       });
       res.send({status: 200});
     }
   });
};

//changes affiliation
//(sends notification to all friends as well)
var changeAffiliation = function(req, res) {
  var user = req.userdata.username;
  var affiliation = req.body.affiliation;
  db.change_affiliation(user, affiliation, function (err, data) {
    if (err) {
      console.log(err);
      res.send(err);
    } else {
      if(! req.userdata.friends) {
        req.userdata.friends = []
      };
      req.userdata.friends.filter(x => x.status == 2).forEach(f => {
        db.add_notif(user, f.username, 'a', affiliation, function(success,error){
        });
      });
      res.send({status: 200});
    }
  });
};

//changes password
var changePassword = function(req, res) {
  var user = req.userdata.username;
  var password = req.body.password;
  db.change_password(user, password, function (err, data) {
    if (err) {
      console.log(err);
      res.send(err);
    } else {
      console.log("Password changed!");
      res.send({status: 200});
    }
  });
};

//chnages orientation
//(sends notification to all friends)
var changePolOrient = function(req, res) {
  var user = req.session.user;
  var polOrient = req.body.polOrient;
  db.change_pol_or(user, polOrient, function (err, data) {
    if (err) {
      console.log(err);
      res.send(err);
    } else {
      if(! req.userdata.friends) {
        req.userdata.friends = []
      };
      req.userdata.friends.filter(x => x.status == 2).forEach(f => {
        db.add_notif(user, f.username, 'p', polOrient, function(success,error){
        });
      });
      res.send({status: 200});
    }
  });
};

//helper method to sedn friend request
var requestFriend = function(username, friend, callback) {
  db.add_friend(username, friend, 0, function(err, data){
    if (err){
      callback(err, null);
    } else {
      db.add_friend(friend, username, 1, function(err, data){
        if (err){
          callback(err, null);
        } else {
          callback(null, username + " and " + friend + " are now friends");
        }
      });
    }
  });
};

//helper method to confirm friendship
var becomeFriends = function(username, friend, callback) {
  db.become_friends(username, friend, function(err, data) {
    if (err) {
      callback(err, null);
    } else {
      db.become_friends(friend, username, function(err, data) {
        if (err) {
          callback(err, null);
        } else {
          callback(null, username + " and " + friend + " are now friends");
        }
      });
    }
  });
};

//helper method to remove friend
var removeFriend = function(username, friend, callback) {
  db.remove_friend(username, friend, function(err, data) {
    if (err) {
      callback(err, null);
    } else {
      db.remove_friend(friend, username, function(err, data) {
        if (err) {
          callback(err, null);
        } else {
          callback(null, username + " and " + friend + " are no longer friends");
        }
      });
    }
  });
}

//one route to handle friend requests
var friendRequest = function(req, res) {
  var username = req.session.user;
  var friend = req.body.username;
  var data = req.userdata;
  var num = statusNumber(data, friend);
  console.log(username + ' to ' + friend + ': ' + num);
  var response = function(status, err, a, b) {
    res.send({status: status, err: err, userA: a, userB: b});
  }
  if (num === 0) {
    response(500, 'Already requested', -1, -1);
  } else if (num === 1) {
    becomeFriends(username, friend, function(err, data) {
      response(err?500:200, err, 2, 2);
    });
  } else if (num === 2) {
    removeFriend(username, friend, function(err, data) {
      response(err?500:200, err, false, false);
    });
  } else if (num === -1) {
    requestFriend(username, friend, function(err, data) {
      if(err){
        response(500, err, -1, -1);
      }else{
        db.add_notif(username, friend, 'f', 'Friend request received', function(success, error){
          if(error){
            console.log(error);
          }
        });
        response(200, err, 0, 1);
      }
    });
  } else {
    response(500, 'Something went wrong', -1, -1);
  }
};



//loads the original visualizer data depending on the user logged in
var visualizer = function(req, res) {
  var user = req.session.user; //actually would be req.session.user
db.get_friends(user, function(err, data){
    if (err) {
      res.send(err);}
    else {
      var children = [];
    for (var i = 0; i < data.length; i++){
      if (data[i].status === 2){
      children.push({"id": data[i].username,
      "name": data[i].username,
      "data": {},
      //if (data[i].affiliation === first_affiliation)
      "children": []})
    }
};
      var json = {"id": user,"name": user ,"children": children};;
res.send(json)
    }
  });
};

//for visualizer
var getNextFriends = function(req, res){
  var user = req.userdata.username;
  var curr = req.body.nodeId;

  new Promise((r1, r2) => {
    db.get_affiliation(user, function(err, data){
      if(err){
        r2(err);
      } else {
        db.get_affiliation(curr, function(err, data_stuff){
          if(err){
            r2(err);
          } else {
          //console.log("Affiliation is " + data);
          }
          var passthis = {aff1: data, aff2: data_stuff};
          r1(passthis);
        });
      //console.log("Affiliation is " + data);
      }
    });
  }).then(function(result){
    var first_affiliation = result.aff1;
    var current = result.aff2;
    if (first_affiliation === current){
    db.get_friends(curr, function(err, data){
        if (err) {
          res.send(err);}
        else {
          var children = [];
          var promises = [];
        for (var i = 0; i < data.length; i++){
          if (data[i].status === 2){
          promises.push(
          new Promise((resolve, rej) => {
            var backup = data[i].username;
          db.get_affiliation(backup, function(err, data2){
            if (err){
              rej(err);
            } else {
              var passon = {username: backup, data: data2};
              resolve(passon);
            }
          });
        }).then(function(answer){
            var curr_aff = answer.data;
            if (curr_aff === first_affiliation){
              children.push({"id": answer.username,
              "name": answer.username,
              "data": {},
              "children": []})
            }
          }, function(error){
            res.send(error);
          }));
        }
    };
    Promise.all(promises).then(function(resultant){
     var json = {"id": curr,"name": curr ,"children": children};
      res.send(json)
    }, function(error){
      res.send(error);
    });
        }
      });
    }
  }, function(error){
    res.send(err);
  });
}

/**
 * Query all notifications, simply using the database model (delegate)
 * (The used database function is using Promises. Eventually migrate everything to promises.)
**/
var get_notifs = function(req, res) {
  db.get_notifs(req.userdata.username).then(s => {
    res.send({status: 200, notifications: s});
  }, e => {
    res.send({status: 4001, err: e});
  });
}

//TODO! Put the friend recommendations & feed populated items.
var hadoopPut = function(req, res){

  var user = req.body.user;
  var users = req.body.recs;
  User.update({username: user, recommendations: JSON.parse(users)}, function(err){});
  res.send({});
}

var hadoopGet = function(req, res) {
  if(! req.body.key || req.body.key != "you will never get my key hahaha") {
    res.send("wrong key");
    return;
  }
  User.scan().loadAll().exec(function(err, data){
    if(err) {
      res.send({status: 4001, err: err});
      return;
    }
    var items = data["Items"].map(item=>item.attrs);
    var result = [];
    items.forEach(u => {

      var addp = (p, up) => {
        result.push(encodeURIComponent(u.username) + (up?" upvote ":" dovote ") + p);
      };
      if(!u.agrees) u.agrees = [];
      if(!u.disagrees) u.disagrees = [];
      u.agrees.forEach(a => addp(a, true));
      u.disagrees.forEach(a => addp(a, false));
    });
    Post.scan().loadAll().exec(function(err, data){
      if(err) {
        res.send({status: 4001, err: err});
        return;
      }
      var items = data["Items"].map(item=>item.attrs);
      items.forEach(post=>{
        if(!post.topic) post.topic = [];
        post.topic.forEach(inte => {
          result.push(post.postID + " interest " + inte);
        });
      });
      res.send(result);
    });;
  });;
};
var sparkGetPosts = function(req, res) {
  if(! req.body.key || req.body.key != "you will never get my key hahaha") {
    res.send("wrong key");
    return;
  }
  console.log('GET POSTS SPARK');
  Post.scan().loadAll().exec(function(err, data) {
    var result = [];
    data["Items"].map(item => item.attrs).forEach(post => {
      if(! post.topic) post.topic = [];

      post.topic.forEach(interest => {
        result.push(post.postID + " " + interest);
      });

    });
    console.log(result);
    res.send(result);
  });
};
var sparkPutFeed = function(req, res) {
  console.log('Putting:');
  console.log(req.body);
  var user = req.body.user;
  var feed = JSON.parse(req.body.feed);
  console.log(feed);
  if(feed.length == 0) return;
  User.update({username: user, feed: feed}, function(err){});
  res.send({});
};

var routes = {
    spark_get: hadoopGet,
    spark_put: hadoopPut,
    spark_get_posts: sparkGetPosts,
    spark_put_feed: sparkPutFeed,
    load_chat: loadChat,
    send_message: sendMessage,
    chat: chat,
    set_username: setUsername,
    main: main,
    add_user: addUser,
    get_signup: getSignup,
    check_login: checkLogin,
    get_user_data: getUserData,
    get_logout: getLogout,
    set_time: setTime,
    get_time: getTime,
    get_visualizer: visualizer,
    request: friendRequest,
    search_users: userSearch,
    credential_check: credential_check,
    change_password: changePassword,
    change_mood: changeMood,
    add_int: addInt,
    del_int: delInt,
    change_affiliation: changeAffiliation,
    change_pol_or: changePolOrient,
    get_next_friends : getNextFriends,
    get_notifs: get_notifs,
};
module.exports = routes;

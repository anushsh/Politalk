//requiremenents
var express = require('express');
var routes = require('./requests/routes.js');
var feed = require('./requests/feed.js');
var session = require('express-session');
var cookieParser = require('cookie-parser');

//app initiailziation
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);

app.use(express.json());
app.use(express.urlencoded());
app.use(express.logger("default"));
app.use(express.cookieParser());
app.use(express.session({
    secret: "secret-token",
    cookies: {
        user: ''
    }
}));
app.use(express.static('public'));


//get routes and middleware
app.post('/spark_get', routes.spark_get);
app.post('/spark_put', routes.spark_put);
app.post('/spark_get_posts', routes.spark_get_posts);
app.post('/spark_put_feed', routes.spark_put_feed);
app.get('/login', routes.main);
app.get('/signup', routes.get_signup);
app.get('*', function(req, res, next){
    routes.credential_check(req, function(success, data) {
	console.log(success);console.log(data);
	if(!success){
            res.redirect('/login');
        }else{
            req.userdata = data;
            next();
        }
    });
});

//post routes and middleware
app.post('/createaccount', routes.add_user);
app.post('/checklogin', routes.check_login);
app.post('*', function(req, res, next){
    routes.credential_check(req, function(success, data) {
        if(!success){
            res.send({status: 403, err: 'Not logged in.'});
        }else{
             req.userdata = data;
             next();
        }
    });
});


app.post('/request', routes.request);
app.post('/userdata', routes.get_user_data);
app.get('/logout', routes.get_logout);
app.post('/loadChat', routes.load_chat);
app.post('/sendMessage', routes.send_message);
app.get('/chat', routes.chat);
app.post('/setUsername', routes.set_username);
app.post('/post', feed.get_post);
app.post('/posts', feed.query_posts);
app.post('/user_posts', feed.posts_by);
app.post('/comments', feed.query_comments);
app.post('/vote', feed.vote_content);
app.post('/create', feed.create_content);
app.post('/searchUsers', routes.search_users);
app.post('/changeMood', routes.change_mood);
app.post('/changePassword', routes.change_password);
app.post('/changeAffiliation', routes.change_affiliation);
app.post('/addInt', routes.add_int);
app.post('/delInt', routes.del_int);
app.post('/changeOrientation', routes.change_pol_or);
app.post('/getNotifs', routes.get_notifs);
app.get('/friendvisualizer', function(req, res) {
   res.render('friendvisualizer.ejs');
});
app.get('/friendvisualization', routes.get_visualizer);
app.post('/getFriends', routes.get_next_friends);
app.post('/getTime', routes.get_time);
app.post('/setTime', routes.set_time);

//redirect to index for all oither routes
app.get('*', function(req, res){
  res.sendfile('public/frontend/html/index.html');
});

//chat stuff
io.on('connection', function(socket) {
  console.log("connection established");
  var username = socket.handshake.query.username;
  socket.join(username); // each socket in their own room
  socket.username = username;
  console.log(username + " is active");

  socket.on('chat_message', function(msg) {
      console.log('message INCOMING!');
      io.in(msg.room).emit('chat_message', msg);
  });

  socket.on('chat_join', function(msg) {
      socket.to(msg.to).emit('chat_join', msg);
      socket.join(msg.to);
  });

  socket.on('chat_leave', function(msg) {
      socket.leave(msg.to);
      socket.to(msg.to).emit('chat_leave', msg);
      //kick all others out of its room
      var room = socket.username;
      console.log('clearing ' + room);
      io.in(room).clients((error, socketIds) => {
          if (error) {
              throw error;
          }
          socketIds.forEach(function(socketId) {
              var socket = io.sockets.sockets[socketId];
              //do not kick person out of own room
              if (socket.username != room) {
                  socket.leave(room);
              }
          });
      });
  });

  socket.on('chat_rescind', function(msg) {
      socket.to(msg.to).emit('chat_rescind', msg);
  });

  socket.on('chat_reject', function(msg) {
      socket.to(msg.to).emit('chat_reject', msg);
  });

  socket.on('private_request', function(msg) {
      socket.to(msg.to).emit('private_request', msg);
  });

  socket.on('disconnect', function(socket) {
      console.log("someone left");
  });
});

//because on ec2 I redirected traffic into port 80 to port 3000 because I
//was unable to listen directly on port 80
server.listen(3000);
console.log('Server running on port 80 (via port 3000)');

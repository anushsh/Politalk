//Wall has 3 parts:
// - info about the user being viewed (+ settings if has permissions)
// - posts written by the user (+ only view anonymous ones if permissions)
// - comments written by the user (+ only view anonymous ones if permissions)
//
//
//
//
var wall_init = function(permission, options) {
  var data1, data2, data3, counter = 0;

  var shwbtn = function(a, b) {
    if(a === false || a === undefined){
      //Send friend request
      $("#btnplc").html(loadTemplate("friendbtn", {text: 'Send request', class: 'success'}));
    }else if(a.status == 2){
      //Unfriend
      $("#btnplc").html(loadTemplate("friendbtn", {text: 'Unfriend', class: 'danger'}));
    }else if(a.status == 1) {
      //Accept request
      $("#btnplc").html(loadTemplate("friendbtn", {text: 'Accept request', class: 'primary'}));
    }else{
      //Already requested
      $("#btnplc").html(loadTemplate("friendbtn2", {}));
    }
  };

  var buttonClick = function() {
    $.post('/request', {username: data3.username}, function(dta){
      shwbtn(dta.userA, dta.userB);
    });
  }

  var callback = function() {
    counter++;
    if(counter == 3 && permission.use()) {
      data1.Items.forEach(function(item){
        item.none = "";
        item.anonymous = "Anonymous";
        $("#wall-comments").append(loadTemplate("comment", item));
      });
      data2.Items.forEach(function(item) {
        item.none = "";
        item.anonymous = "Anonymous";
        $("#wall-posts").append(loadTemplate("post", item));
      });
      $('#uinfo').html(loadTemplate("userinfo", data3));

      if(!data3.friends) {
        data3.friends = [];
      }
      if(!data3.recommendations) {
        data3.recommendations = [];
      }
      data3.friends.forEach(function(friend){
        if(friend.status != 2) {
          return;
        }
        $("#fl").append(loadTemplate("friend", friend));
      });
      data3.recommendations.forEach(function(rec){
        $("#fr").append(loadTemplate("rec", {username: rec}));
      });

      if(!data3.interests){
        data3.interests = [];
      }
      if(data3.interests.length == 0) {
        $("#myints").append(loadTemplate("nointmsg", {}));
      }
      data3.interests.forEach(function(interestItem){
        $("#myints").append(loadTemplate(data3.username == CURRENT_USER.username?"rint":"int", {interest: interestItem}));
      });
      if(data3.username == CURRENT_USER.username) {
        //ADD SETTINGS TODO
        $("#myints").on("click", ".remthisint", function(){
          var thisint = $(this).attr('int');
          var parent = $(this).parent();
          $.post('/delInt', {interest: thisint}, function(data){
            if(data.status == 200) {
              parent.remove();
            }
          });
        });
        $("#myints").append(loadTemplate("addint", {}));
        $("#settings").html(loadTemplate("usersettings", CURRENT_USER));
        $("#changemood").on("input", function(){
          var mood = $(this).val();
          $.post('/changeMood', {mood: mood}, function(data){
            if(data.status == 200) {
              CURRENT_USER.mood = mood;
              $("#mood").text(mood);
            };
          });
        });
        $("#changeaffiliation").on("input", function(){
          var aff = $(this).val();
          $.post('/changeAffiliation', {affiliation: aff}, function(data){
            if(data.status == 200) {
              CURRENT_USER.affiliation = aff;
              $("#affiliation").text(aff);
            };
          });
        });
        var p_o = document.getElementById("p_o");
        p_o.oninput = function(){
          var po = $(p_o).val();
          $.post('/changeOrientation', {polOrient: po}, function(data){
            if(data.status == 200) {
              //TODO update color
            };
          });
        };
        $("#changepw").click(function(){
          var pw = $("#changepassword").val();
          $.post('/changePassword', {password: pw}, function(data){
            if(data.status == 200) {
              document.notify("Password got changed successfully.", "success");
            }
          });
        });
        $("#addint").click(function(){
          var int = $("#addinterest").val();
          var pppp = $("#addinterest");
          $.post('/addInt', {interest: int}, function(data){
            if(data.status == 200) {
              pppp.val('');
              $("#myints").prepend(loadTemplate('rint', {interest: int}));
            }
          });
        });
      }else{
        $("#rc1").hide();
        //Friendship table
        // A | B
        // x | x : no relationship
        // 0 | 1 : A requests B
        // 1 | 0 : B requests A
        // 2 | 2 : Friends
        var friendshipA = (!CURRENT_USER.friends)?false:CURRENT_USER.friends.getByKey('username', data3.username);
        //var friendshipB = data3.friends.getByKey('username', CURRENT_USER.username);
        shwbtn(friendshipA, 'x');
        $("#btnplc").find('button').click(buttonClick);
      }
    }
  };
  //get user data somehow
  var params = {commentsBy: 'userId'};
  if('userId' in options && options.userId != undefined && options.userId.length > 0) {
    params.userId = options.userId;
  }
  $.post('/comments', params, function(data){
    if(data.status != 200) {
      alert('Error querying comments.');
      data1 = [];
    }else{
      data1 = data;
    }
    callback();
  });
  params = {};
  if('userId' in options && options.userId != undefined && options.userId.length > 0) {
    params.username = options.userId;
  }
  $.post('/user_posts', params, function(data) {
    if(data.status != 200) {
      alert('Error querying posts.');
      data2 = [];
    }else{
      data2 = data;
    }
    callback();
  });
  $.post('/userdata', params, function(data) {
    if(data.status != 200) {
      alert('Error querying user setting data.');
      data3 = [];
    }else{
      data3 = data;
    }
    callback();
  });
};

var singlepost_init = function(perm, opt) {
  $.post('/post', {postId: opt.postId}, function(data) {
    if(! perm.use()) {
      return;
    }
    if(data.status == 200) {
      data.post.none = "";
      data.post.anonymous = "Anonymous";
      $("#singlepost").append(loadTemplate("post", data.post));
    }else{
      //document.notify("Couldn't load specific post.", "c");
    }
  });
}

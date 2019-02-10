var user_init = function(permission) {

  var shwbtn = function(a, b) {
    if(a.status === false || a === undefined || a.status === undefined){
      //Send friend request
      return (loadTemplate("friendbtn", {text: 'Send request', class: 'success'}));
    }else if(a.status == 2){
      //Unfriend
      return (loadTemplate("friendbtn", {text: 'Unfriend', class: 'danger'}));
    }else if(a.status == 1) {
      //Accept request
      return (loadTemplate("friendbtn", {text: 'Accept request', class: 'primary'}));
    }else{
      //Already requested
      return (loadTemplate("friendbtn2", {}));
    }
  };

  var buttonClick = function() {
    var p = $(this).parent();
    $.post('/request', {username: $(this).parent().attr('usrnme')}, function(dta){
      if(!CURRENT_USER.friends) {
        CURRENT_USER.friends = [];
      }
      if(!CURRENT_USER.friends || !CURRENT_USER.friends.getByKey('username', p.attr('usrnme'))){
        CURRENT_USER.friends.push({username: p.attr('usrnme'), status: dta.userA});
      }else{
        CURRENT_USER.friends.getByKey('username', p.attr('usrnme')).status = dta.userA;
      }
      if(dta.userA == false) {
        //CURRENT_USER.friends.getByKey('username', p.attr('usrnme'));
      }
      p.html(shwbtn({status: dta.userA}, {status: dta.userB}));
    });
  }

  var findResults = function(){
    var val1 = $("#query").val();
    if(val1 == '') {
      $('#search_results').html('');
    }
    $.post('/searchUsers', {query: val1}, function(data) {
      $('#search_results').html('');
      data.forEach(function(val, i) {
        append_result(val);
      });
    });
    return false;
  };

  var append_result = function(val) {
    var friendshipA = (!CURRENT_USER.friends)?false:CURRENT_USER.friends.getByKey('username', val.username);
    var res = shwbtn(friendshipA, 'x');
    var curr = $(loadTemplate("userres", val)).appendTo("#search_results");
    curr.find('.buttonplace')
    .html(shwbtn(friendshipA))
    .find('button').click(buttonClick);
  };

  $('#searchform').submit(function() {
    findResults();
    return false;
  });
  $('#query').keyup(function(){
    findResults();
  });
}

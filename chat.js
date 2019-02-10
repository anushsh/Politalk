$(function() {
  var status = 'alone';
  var room = username;
  var others = [];

  var socket = io(window.location.origin, {
    query: 'username=' + username
  });

//check if each friend has pinged in the last 10 seconds
var checkFriends = function() {
  $.each(friendsList, function(i, val) {
    $.post('/getTime', {user: val}, function(data) {
      var tr = $("tr:contains(" + val + ")");
      if (Date.now() - data < 10000) {
        tr.find("td").eq(1).text('active');
        tr.find("button").show();
      } else {
        tr.find("td").eq(1).text('inactive');
        tr.find("button").hide();
      }
    });
  });
};

checkFriends();

//click send button
$('form').submit(function() {
  var data = {
    room: room,
    from: username,
    message: $('#m').val()
  };
  socket.emit('chat_message', data);
  if (status == 'private') {
    data['to'] = others[0];
    $.post('/sendMessage', data, function(data){});
  }
  $('#m').val('');
  return false;
});

//appends message
var addMessage = function(msg) {
  msg = "<b>" + msg.from + ":</b> " + msg.message;
  $('#messages').append($('<li class="list-group-item">').html(msg));
}

//append message when recieved
socket.on('chat_message', function(msg) {
  addMessage(msg);
  $('#messages').scrollTop($('#messages').prop("scrollHeight"));
});

var rescindAndReject = function() {
  $('#friends button').each(function() {
    var b = $(this);
    var other = b.closest("tr").prop("id");
    var payload = {
      from: username,
      to: other
    };
    if (b.attr('state') == 'accept_req') {
      socket.emit('chat_reject', payload);
      b.removeClass('btn-outline-success')
      .addClass('btn-outline-primary')
      .attr('state', 'send_req')
      .text('Request Chat');
    } else if (b.text() == 'Request Sent') {
      socket.emit('chat_rescind', payload);
      b.text('Request Chat');
    }
    if (!b.prop('disabled') && b.attr('state') != 'leave') {
      b.prop('disabled', true);
    }
  });
};

//load messages from 2 users
var loadMessages = function(other) {
  var payload = {
    user1: username,
    user2: other
  }
  console.log('loading chat: ' + JSON.stringify(payload));
  $.post('/loadChat', payload, function(data) {
    var d = $('#messages');
    d.html('');
    console.log(data);
    if (data.constructor === Array && data.length > 0) {
      $.each(data, function (i, val) {
        addMessage(val);
      });
    } else {
      d.append($('<li class="list-group-item">').text('Welcome to your new chat!'));
    }
    d.scrollTop(d.prop("scrollHeight"));
  });
};

$("#friends button").click(function() {
  //send private chat request
  var b = $(this);
  var other = b.closest("tr").prop("id");
  if (status == 'alone') {
    if (b.attr('state') == 'send_req') {
      var data = {
        to: other,
        from: username
      };
      socket.emit('private_request', data);
      b.prop('disabled', true)
      .text('Request Sent');
      console.log('request sent');
    } else if (b.attr('state') == 'accept_req') {
      var data = {
        to: other,
        from: username
      };
      others = [other];
      status = 'private';
      room = other;
      socket.emit('chat_join', data);
      $('#send').prop('disabled', false);
      b.removeClass('btn-outline-success')
      .addClass('btn-outline-danger')
      .attr('state', 'leave')
      .text('Leave Chat');
      rescindAndReject();
      loadMessages(other);
    }
  } else if (status == 'private' || status == 'group') {
    if (b.attr('state') == 'send_req') {
      var data = {
        to: other,
        from: username,
        group:  others
      };
      socket.emit('group_request', data);
      b.prop('disabled', true)
      .text('Request Sent');
    } else if (b.attr('state') == 'accept_req') {
      if (status == 'private') {
        //switch out of old private chat into newly requested private chat
        var old = others[0];
        var data = {
          to: old,
          from: username
        }
        socket.emit('chat_leave', data);
        $("tr:contains(" + old + ")").find("button")
        .removeClass('btn-outline-danger')
        .addClass('btn-outline-primary')
        .attr('state', 'send_req')
        .prop('disabled', false)
        .text('Request Chat');
        data = {
          to: other,
          from: username
        };
        others = [other];
        room = other;
        socket.emit('chat_join', data);
        $('#send').prop('disabled', false);
        b.removeClass('btn-outline-success')
        .addClass('btn-outline-danger')
        .attr('state', 'leave')
        .text('Leave Chat');
        rescindAndReject();
        loadMessages(other);
      } else {
        //handle group leaving for another chat
      }
    } else if (b.attr('state') == 'leave') {
      var data = {
        to: other,
        from: username
      }
      socket.emit('chat_leave', data);
      status = 'alone';
      room = username;
      others = [];
      $('#messages').html('');
      $('#send').prop('disabled', true);
      b.removeClass('btn-outline-danger')
      .addClass('btn-outline-primary')
      .attr('state', 'send_req')
      .text('Request Chat');
      $('#friends button').each(function() {
        $(this).prop('disabled', false);
      });
    }
  }
});

socket.on('chat_join', function(msg) {
  var from = msg.from;
  console.log('chatting with: ' + from);
  status = 'private';
  others = [from];
  $('#send').prop('disabled', false);
  $("tr:contains(" + from + ")").find("button")
  .removeClass('btn-outline-primary')
  .addClass('btn-outline-danger')
  .text('Leave Chat')
  .prop("disabled", false)
  .attr('state', 'leave');
  rescindAndReject();
  loadMessages(from);
});

//other leaves (private) chat
socket.on('chat_leave', function(msg) {
  var from = msg.from;
  room = username;
  status = 'alone';
  others = [];
  console.log(from + ' left the chat');
  $('#messages').html('');
  $('#send').prop('disabled', true);
  $("tr:contains(" + from + ")").find("button")
  .removeClass('btn-outline-danger')
  .addClass('btn-outline-primary')
  .text('Request Chat')
  .attr('state', 'send_req');
  $('#friends button').each(function() {
    $(this).prop('disabled', false);
  });
});

socket.on('private_request', function(msg) {
  //cannot join a group, can only be invited
  if (username == msg.to) {
    var from = msg.from;
    console.log('request from: ' + from);
    $("tr:contains(" + from + ")").find("button")
    .removeClass('btn-outline-primary')
    .addClass('btn-outline-success')
    .prop('disabled', false)
    .text('Accept Request')
    .attr('state', 'accept_req');
  }
});

socket.on('chat_rescind', function(msg) {
  var from = msg.from;
  console.log(from + ' rescinded their request');
  $("tr:contains(" + from + ")").find("button")
  .removeClass('btn-outline-success')
  .addClass('btn-outline-primary')
  .attr('state', 'send_req')
  .text('Request Chat');
});

socket.on('chat_reject', function(msg) {
  var from = msg.from;
  console.log(from + ' rejected your request');
  $("tr:contains(" + from + ")").find("button")
  .prop('disabled', false)
  .text('Request Chat');
});

setInterval(function() {
  // console.log('room: ' + room);
  // socket.emit('keep_alive', {});
  $.post('/setTime', {}, function(data){});
  checkFriends();
}, 3000);

$(window).on("unload", function() {
  socket.emit('leave');
  if (status == 'private') {
    var old = others[0];
    var data = {
      to: old,
      from: username
    }
    socket.emit('chat_leave', data);
    $('#send').prop('disabled', true);
  } else if (status == 'group') {
    console.log('group stuff');
    //leave group handle
  }
});

});

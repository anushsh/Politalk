var feed_init = function(permission){
  $.post('/posts', {offset: 0, amount: 5}, function(data, stat) {
    if(data.status != 200) {
      alert("Error querying posts.");
    }else{
      if(! permission.use()) {
        return;
      }
      data.Items.forEach(function(item) {
        item.none = "";
        item.anonymous = "Anonymous";
        $("#feed").append(loadTemplate("post", item));
      });
    }
  });
};
$(document).on("click", '.agree', function(){
  var p = $(this);
  $.post('/vote', {contentType: 'post', contentKey: $(this).attr('postID'), vote: 1}, function(d){
    if(d.status != 200){return;}
    $.post('/post', {postId: p.attr('postID')}, function(data) {
      p.parent().parent().parent().replaceWith(loadTemplate("post", data.post));
    });
  });
});
$(document).on("click", '.disagree', function(){
  var p = $(this);
  $.post('/vote', {contentType: 'post', contentKey: $(this).attr('postID'), vote: -1}, function(d){
    if(d.status != 200){return;}
    $.post('/post', {postId: p.attr('postID')}, function(data) {
      p.parent().parent().parent().replaceWith(loadTemplate("post", data.post));
    });
  });
});
$(document).on("click", '.loadcomments', function(){
  var elem = $(this);
  elem.text('// Loading //');
  $.post('/comments', {commentsBy: 'postId', postId: elem.attr('postID')}, function(data){
    if(data.status != 200) {
      elem.text('Try again');
      document.notify('Error querying comments.');
    }else{
      elem.text('Refresh comments');
      elem.next().empty();
      data.Items.forEach(function(item){
        elem.next().append(loadTemplate("comment", item));
      });
    }
  });
});//TODO VOTING + CREATING

$(document).on("click", '.new-comment', function(){
  var cmt = $(this).prev().val();
  var p = $(this);
  $(this).text('//////////');
  if(cmt.length < 5){
    document.notify('Comment too short', 'danger');
    $(this).text('Write comment');
    return;
  }

  $.post('/create', {contentType: 'comment', content: cmt, postId: $(this).attr('postID')}, function(data){
    if(data.status != 200) {
      document.notify('Oops, something went wrong.');
    }else{
      p.prev().val('');
      p.text('Write comment');
      document.notify('Comment created!');
    }
  });
});

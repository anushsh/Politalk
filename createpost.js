create_init = function(permission, options){
  $(document).on("click", '#submit-post', function(){
    var anon = $('#anontoggle').is(':checked');
    var title = String($("#create-title").val());
    var content = String($("#create-content").val());
    var tags = String($("#create-tags").val()).split(" ");//Careful
    //TODO Validate
    $.post('/create', {contentType: 'post', title: title, content: content, topics: tags, anon: anon}, function(data){
      if(data.status == 200) {
        $("#create-title").val("");
        $("#create-content").val("");
        $("#create-tags").val("");
        document.notify('Discussion opened - go to your profile to view.', 'a');
      }else{
        document.notify('Couldn\'t create discussion, please check whether you entered correct information.', 'c');
      }
    });
  });
}

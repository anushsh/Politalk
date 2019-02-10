var current_templates = [];


function initTemplates() {
  $("template").each(function(i) {
    var elem = $(this);
    elem.hide();
    var name = elem.attr("name");
    var html = elem.html();
    current_templates[name] = html;
  });
}

/*
Returns a string containing the populated html of the template

TODO this is a very quick attempt at a templating engine... for-loop doesnt work yet :(
*/
function loadTemplate(templateName, args) {
  var afterCmd = '';
  var context = args;
  var result = '', cmd = '';
  var inFor = false;
  var execCmd = function(command) {
    var parts = command.split(" ");
    if(inFor && parts[0] != 'endfor') {
      return '{{' + command + '}}';
    }
    switch(parts[0]){
      case 'replace': return context[parts[1]];
      case 'if': return context[parts[1]]?context[parts[2]]:context[parts[3]];

      case 'for': {
        afterCmd = result;
        result = '';
        context = args[[parts[1]]];
        inFor = true;
        return '';
      }
      case 'endfor': {
        var tmp = result;
        var inFor = false;
        var result1 = '';result = '';
        var rc = context;
        for(var j = 0; j < rc.length; j++) {

          context = {item: rc[j]};

          evaluate(tmp);  //console.log(result);
        }
        context = args;
        result = afterCmd + result;
        return '';
      }
      default: return context[parts[0]];
    }
  };
  var evaluate = function(text) {
    var waiting = false, first = false;
    for(var i = 0; i < text.length; i++) {
      var c = text.charAt(i);
      if(! waiting) {
        if(c == '{'){
          if(first){
            waiting = true;
            first = false;
            continue;
          }else{
            first = true;
            continue;
          }
        }else{
          if(first) {
            result += '{';
            first = false;
          }
          result += c;
        }
      }else{
        if(c == '}'){
          if(first) {
            first = false;
            result += execCmd(cmd);
            cmd = '';
            waiting = false;
          }else{
            first = true;
          }
        }else{
          cmd += c;
        }
      }
    }
  }

  var tmplcpy = current_templates[templateName];
  evaluate(tmplcpy);
  //for(var key in arguments) {
  //  tmplcpy = tmplcpy.replace("$tmpl-"+key, arguments[key]);
  //}
  return result;
}

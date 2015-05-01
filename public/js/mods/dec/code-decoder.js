function CodeDecoder(){}

CodeDecoder.prototype.decode = function(inp, cb){
	var out = inp.slice(0, inp.length);
	for(var i = 0; i < inp.length; i++){
		if(typeof(inp[i]) == "object" && inp[i].codec !== undefined && inp[i].codec.namespace == "com.alamod" && inp[i].codec.type == "code"){
			out[i] = new Handlebars.SafeString("<code>" + inp[i].content.code + "</code>");
		}
	}
	cb(out);
}
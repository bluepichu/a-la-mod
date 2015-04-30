function GithubIssueDecoder(){}

GithubIssueDecoder.prototype.decode = function(inp, cb){
	var out = inp.slice(0, inp.length);
	for(var i = 0; i < inp.length; i++){
		if(typeof(inp[i]) == "object" && inp[i].codec.type == "issue"){
			out[i] = "<a href='" + inp[i].content.url + "' target='_blank'><i>#" + inp[i].content.number + ": " + inp[i].content.title + " [" + inp[i].content.state.toUpperCase() + "]</b></a>";
		}
	}
	cb(out);
}
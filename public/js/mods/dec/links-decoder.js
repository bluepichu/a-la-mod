function LinksDecoder(){}

LinksDecoder.prototype.decode = function(inp){
	var out = inp.slice(0, inp.length);
	for(var i = 0; i < inp.length; i++){
		if(typeof(inp[i]) == "object" && inp[i].codec.type == "link"){
			out[i] = "<a href='" + inp[i].content.url + "' target='_blank'>" + inp[i].content.text + "</a>";
		}
	}
	return out;
}
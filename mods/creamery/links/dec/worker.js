importScripts("/mods/utils/mod-base");

registerMethod("decode", function(inp, cb){
	inp = inp.message;
	var out = inp.slice(0, inp.length);
	for(var i = 0; i < inp.length; i++){
		if(typeof(inp[i]) == "object" && inp[i].codec !== undefined && inp[i].codec.type == "link"){
			out[i] = {type: "SafeString", content: "<a href='" + inp[i].content.url + "' target='_blank'>" + inp[i].content.text + "</a>", decoder: "creamery/links"};
		}
	}
	cb({message: out});
});

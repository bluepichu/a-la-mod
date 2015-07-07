importScripts("/mods/utils/mod-base", "/mods/utils/pattern-matcher");

registerMethod("encode", function(inp, cb){
	matchPattern(inp.message, /img\[(.*?)\]/, function(match, cb){
		cb({
			codec: {
				namespace: "creamery",
				type: "image"
			},
			content: {
				url: match[1]
			},
			fallback: match[1]
		});
	}, function(data){
		cb({message: data});
	});
});

registerMethod("decode", function(inp, cb){
	inp = inp.message;
	var out = inp.slice(0, inp.length);
	for(var i = 0; i < inp.length; i++){
		if(typeof(inp[i]) == "object" && inp[i].codec !== undefined && inp[i].codec.type == "image"){
			out[i] = {type: "SafeString", content: "<img src='" + inp[i].content.url + "'>", decoder: "creamery/image"};
		}
	}
	cb({message: out});
});

importScripts("/mods/utils/mod-base", "/mods/utils/pattern-matcher");

registerMethod("decode", function(inp, cb){
	inp = inp.message;
	var out = inp.slice(0, inp.length);
	for(var i = 0; i < inp.length; i++){
		if(typeof(inp[i]) == "object" && inp[i].codec !== undefined && inp[i].codec.namespace == "creamery" && inp[i].codec.type == "code"){
			out[i] = {type: "SafeString", content: "<code>" + inp[i].content.code + "</code>", decoder: "creamery/code"};
		}
	}
	cb({message: out});
});

registerMethod("encode", function(inp, cb){
	matchPattern(inp.message, /`(.*?)`/, function(match, cb){
		cb({
			codec: {
				namespace: "creamery",
				type: "code"
			},
			content: {
				code: match[1]
			},
			fallback: match[1]
		});
	}, function(data){
		cb({message: data});
	});
});
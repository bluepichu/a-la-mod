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

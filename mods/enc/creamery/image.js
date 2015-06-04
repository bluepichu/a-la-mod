importScripts("/mods/utils/mod-base", "/mods/utils/pattern-matcher");

registerMethod("encode", function(inp, cb){
	matchPattern(inp.message, /(img|image):(.*?)\s?/, function(match, cb){
		cb({
			codec: {
				namespace: "creamery",
				type: "image"
			},
			content: {
				url: match[2]
			},
			fallback: "[image:" + match[2] + "]";
		});
	}, function(data){
		cb({message: data});
	});
});
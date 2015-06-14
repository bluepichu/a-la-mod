importScripts("/mods/utils/mod-base", "/mods/utils/pattern-matcher");

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
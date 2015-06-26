importScripts("/mods/utils/mod-base", "/mods/utils/pattern-matcher");

registerMethod("encode", function(inp, cb){
	matchPattern(inp.message, /\[(.*?)\]\((.*?)\)/, function(match, cb){
		cb({
			codec: {
				namespace: "creamery",
				type: "link"
			},
			content: {
				text: match[1],
				url: match[2]
			},
			fallback: match[1] + " (" + match[2] + ")"
		});
	}, function(data){
		cb({message: data});
	});
});
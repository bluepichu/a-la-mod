importScripts("/mods/utils/mod-base", "/mods/utils/pattern-matcher");

registerMethod("encode", function(inp, cb){
	matchPattern(inp.message, /\$(.*?)\$|\\\((.*?)\\\)/, function(match, cb){
		var eq = match[1] || match[2];
		cb({
			codec: {
				namespace: "creamery",
				type: "katex"
			},
			content: {
				equation: eq
			},
			fallback: eq
		});
	}, function(data){
		cb({message: data});
	});
});
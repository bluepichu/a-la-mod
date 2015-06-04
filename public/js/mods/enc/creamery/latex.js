importScripts("/js/mods/utils/creamery/mod-base.js", "/js/mods/utils/creamery/pattern-matcher.js");

registerMethod("encode", function(inp, cb){
	matchPattern(inp.message, /\$(.*?)\$|\\\((.*?)\\\)/, function(match, cb){
		var eq = match[1] || match[2];
		cb({
			codec: {
				namespace: "com.alamod",
				type: "latex"
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
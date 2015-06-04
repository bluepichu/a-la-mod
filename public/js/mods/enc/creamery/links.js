importScripts("/js/mods/utils/creamery/mod-base.js", "/js/mods/utils/creamery/pattern-matcher.js");

registerMethod("encode", function(inp, cb){
	matchPattern(inp.message, /\[(.*?)\]\((.*?)\)/, function(match, cb){
		cb({
			codec: {
				namespace: "com.alamod",
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
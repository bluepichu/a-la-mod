importScripts("/mods/utils/mod-base", "/mods/utils/pattern-matcher");

registerMethod("encode", function(inp, cb){
	matchPattern(inp.message, /github:(.*?)\/(.*?)\s#?(\d+)/, function(match, cb){
		cb({
			codec: {
				namespace: "creamery.github",
				type: "issue"
			},
			content: {
				owner: match[1],
				repo: match[2],
				issue: parseInt(match[3])
			},
			fallback: match[1] + "/" + match[2] + " #" + match[3]
		});
	}, function(data){
		cb({message: data});
	});
});
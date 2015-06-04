importScripts("/js/mods/utils/creamery/mod-base.js", "/js/mods/utils/creamery/pattern-matcher.js");

registerMethod("encode", function(inp, cb){
	matchPattern(inp.message, /github:(.*?)\/(.*?)\s#?(\d+)/, function(match, cb){
		cb({
			codec: {
				namespace: "com.alamod.github",
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
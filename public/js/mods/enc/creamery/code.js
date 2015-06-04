importScripts("/js/mods/utils/creamery/mod-base.js", "/js/mods/utils/creamery/pattern-matcher.js");

registerMethod("encode", function(inp, cb){
	matchPattern(inp.message, /`(.*?)`/, function(match, cb){
		cb({
			codec: {
				namespace: "com.alamod",
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
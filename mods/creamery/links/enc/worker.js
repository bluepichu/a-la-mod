importScripts("/mods/utils/mod-base", "/mods/utils/pattern-matcher");

registerMethod("encode", function(inp, cb){
	matchPattern(inp.message, /([ "]|^)((https?:\/\/)?([\w_-]+\.)+[\w\/\?=\&]+)(\(([\w ]+)\))?([ "]|$)/, function(match, cb){
		console.log(match[2])
		cb({
			codec: {
				namespace: "creamery",
				type: "link"
			},
			content: {
				url: match[3] ? match[2] : "http://" + match[2],
				text: match[6] || match[2]
			},
			fallback: match[2]
		});
	}, function(data){
		cb({message: data});
	});
});

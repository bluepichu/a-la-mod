importScripts("/mods/utils/mod-base", "/mods/utils/pattern-matcher");

registerMethod("encode", function(inp, cb){
	matchPattern(inp.message, /([ "]|^)((https?:\/\/)?(\w+\.)+\w+)(\(([\w ]+)\))?([ "]|$)/, function(match, cb){
		console.log(match)
		cb({
			codec: {
				namespace: "creamery",
				type: "link"
			},
			content: {
				url: match[3] ? match[2] : "http://" + match[2],
				text: match[6] || match[2]
			},
			fallback: match[1]
		});
	}, function(data){
		cb({message: data});
	});
});

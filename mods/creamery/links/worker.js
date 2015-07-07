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

registerMethod("decode", function(inp, cb){
	inp = inp.message;
	var out = inp.slice(0, inp.length);
	for(var i = 0; i < inp.length; i++){
		if(typeof(inp[i]) == "object" && inp[i].codec !== undefined && inp[i].codec.type == "link"){
			out[i] = {type: "SafeString", content: "<a href='" + inp[i].content.url + "' target='_blank'>" + inp[i].content.text + "</a>", decoder: "creamery/links"};
		}
	}
	cb({message: out});
});
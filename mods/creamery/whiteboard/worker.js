importScripts("/mods/utils/mod-base", "/mods/utils/pattern-matcher");

registerMethod("encode", function(inp, cb){
	cb(inp)
});

ui.onMessage = function(data){
	alm.send([{
		codec: {
			namespace: "creamery",
			type: "whiteboard"
		},
		stream: true,
		content: data,
		fallback: ""
	}]);
}

registerMethod("decode", function(inp, cb){
	inp = inp.message;
	var out = []
	for(var i = 0; i < inp.length; i++){
		if(typeof(inp[i]) == "object" && inp[i].codec !== undefined && inp[i].codec.namespace == "creamery" && inp[i].codec.type == "whiteboard"){
			ui.post(inp[i].content.paths);
		} else {
			out.push(inp[i])
		}
	}
	cb({message: out});
});
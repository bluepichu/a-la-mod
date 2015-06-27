importScripts("/mods/utils/mod-base");

registerMethod("decode", function(inp, cb){
	inp = inp.message;
	var out = []
	for(var i = 0; i < inp.length; i++){
		if(typeof(inp[i]) == "object" && inp[i].codec !== undefined && inp[i].codec.namespace == "creamery" && inp[i].codec.type == "whiteboard"){
			sendMessage(inp[i].content.message);
		} else {
			out.push(inp[i])
		}
	}
	cb({message: out});
});


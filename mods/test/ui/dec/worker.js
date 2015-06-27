importScripts("/mods/utils/mod-base");

registerMethod("decode", function(inp, cb){
	cb({message: inp.message})
	return;
	inp = inp.message;
	var out = inp.slice(0, inp.length);
	for(var i = 0; i < inp.length; i++){
		if(typeof(inp[i]) == "object" && inp[i].codec !== undefined && inp[i].codec.namespace == "creamery" && inp[i].codec.type == "code"){
			out[i] = {type: "SafeString", content: "<code>" + inp[i].content.code + "</code>", decoder: "creamery/code"};
		}
	}
	cb({message: out});
});

registerMethod("postUI", function(data) {
	console.log(data)
})

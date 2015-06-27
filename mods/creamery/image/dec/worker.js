importScripts("/mods/utils/mod-base");

registerMethod("decode", function(inp, cb){
	inp = inp.message;
	var out = inp.slice(0, inp.length);
	for(var i = 0; i < inp.length; i++){
		if(typeof(inp[i]) == "object" && inp[i].codec !== undefined && inp[i].codec.type == "image"){
			out[i] = {type: "SafeString", content: "<img style='width: 100%' src='" + inp[i].content.url + "'>", decoder: "creamery/image"};
		}
	}
	cb({message: out});
});

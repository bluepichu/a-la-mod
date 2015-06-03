importScripts("/js/mods/utils/creamery/mod-base.js");

registerMethod("decode", function(inp, cb){
	inp = inp.message;
	var out = inp.slice(0, inp.length);
	for(var i = 0; i < inp.length; i++){
		if(typeof(inp[i]) == "object" && inp[i].codec !== undefined && inp[i].codec.namespace == "com.alamod" && inp[i].codec.type == "code"){
			out[i] = {type: "SafeString", content: "<code>" + inp[i].content.code + "</code>"};
		}
	}
	cb({message: out});
});
importScripts("/mods/utils/mod-base", "katex.min.js");

registerMethod("decode", function(inp, cb){
	inp = inp.message;
	var out = inp.slice(0, inp.length);
	for(var i = 0; i < inp.length; i++){
		if(typeof(inp[i]) == "object" && inp[i].codec !== undefined && inp[i].codec.namespace == "creamery" && inp[i].codec.type == "katex"){
			try{
				out[i] = {type: "SafeString", content: katex.renderToString(inp[i].content.equation), decoder: "creamery/katex"};
			} catch(e){
				out[i] = {type: "String", content: inp[i].fallback, decoder: "creamery/katex"};
			}
		}
	}
	cb({message: out});
});
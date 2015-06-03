decode = function(inp, cb){
	var out = inp.slice(0, inp.length);
	for(var i = 0; i < inp.length; i++){
		if(typeof(inp[i]) == "object" && inp[i].codec !== undefined && inp[i].codec.namespace == "com.alamod" && inp[i].codec.type == "code"){
			out[i] = {type: "SafeString", content: "<code>" + inp[i].content.code + "</code>"};
		}
	}
	cb(out);
}

onmessage = function(ev){
	var data = ev.data;
	switch(data.operation){
		case "decode":
			decode(data.options.message, function(output){
				postMessage({
					operation: "return",
					requestId: data.id,
					output: {
						message: output
					}
				});
			});
	}
}
decode = function(inp, cb){
	var out = inp.slice(0, inp.length);
	for(var i = 0; i < inp.length; i++){
		if(typeof(inp[i]) == "object" && inp[i].codec !== undefined && inp[i].codec.namespace == "com.alamod" && inp[i].codec.type == "link"){
			out[i] = {type: "SafeString", content: "<a href='" + inp[i].content.url + "' target='_blank'>" + inp[i].content.text + "</a>"};
		}
	}
	cb(out);
}

onmessage = function(ev){
	var data = ev.data;
	switch(data.method){
		case "decode":
			decode(data.options.message, function(output){
				postMessage({
					method: "return",
					requestId: data.id,
					output: {
						message: output
					}
				});
			});
	}
}
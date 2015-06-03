var methods = [];

onmessage = function(ev){
	var data = ev.data;
	if(data.method in methods){
		methods[data.method](data.options, function(ret){
			postMessage({
				method: "return",
				requestId: data.id,
				output: ret
			});
		});
	}
}

registerMethod = function(method, func){
	methods[method] = func;
}
var methods = [];

onmessage = function(ev){
	var data = ev.data;
	if(data.method in methods){
		if (data.method == "postUI") {
			methods[data.method](data.options)
			return
		}
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

sendMessage = function(data) {
	data.method = "postUI"
	postMessage(data)
}

broadcastMessage = function(message) {
	data = {}
	data.message = message
	data.method = "broadcast"
	postMessage(data)
}

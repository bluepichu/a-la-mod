var methods = {};

onmessage = function(ev){
	var data = ev.data;
	if(data.method == "mod.post"){
		if(ui.onMessage){
			ui.onMessage(data.options);
		}
		return;
	}
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

alm = {};

alm.send = function(message){
	var data = {};
	data.message = message;
	data.method = "alm.send";
	postMessage(data);
}

ui = {};

ui.post = function(data){
	data.method = "ui.post";
	postMessage(data);
}

ui.onMessage = null;
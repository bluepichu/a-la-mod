var methods = [];
var parent = null;

window.onload = function(){
	onmessage = function(e){
		if(!e.data){
			return;
		}
		if(e.data.method == "ui.post"){
			if(mod.onMessage){
				mod.onMessage(e.data);
			}
			return;
		}
		if(e.data.method in methods){
			methods[e.data.method](e.data);
		}
	}
	window.top.postMessage({method: "init"}, "*");
}

registerMethod = function(method, cb) {
	methods[method] = cb;
}

mod = {};

mod.post = function(data){
	data.method = "mod.post";
	window.top.postMessage(data, "*");
}

mod.onMessage = null;
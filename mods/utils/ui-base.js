var methods = []
var messages = []
parent = null
window.onload = function() {
	onmessage = function(e) {
		if (!e.data) {
			return;
		}
		if (e.data.method in methods) {
			methods[e.data.method](e.data)
		}
	}
	window.top.postMessage({method: "init"}, "*")
}

registerMethod = function(method, cb) {
	methods[method] = cb
}

sendMessage = function(data) {
	data.method = "send"
	window.top.postMessage(data, "*")
}

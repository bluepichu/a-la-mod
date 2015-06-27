var methods = []
var messages = []
parent = null
window.onload = function() {
	onmessage = function(e) {
		if (!e.data) {
			return;
		}
		if (e.data.method == "init") {
			parent = e.source
			while (messages.length > 0) {
				parent.postMessage(messages.shift(), "*")
			}
		}
		if (e.data.method in methods) {
			methods[e.data.method](e.data)
		}
	}
}

registerMethod = function(method, cb) {
	methods[method] = cb
}

sendMessage = function(data) {
	if (parent) {
		parent.postMessage(data, "*")
	} else {
		messages.push(data)
	}
}

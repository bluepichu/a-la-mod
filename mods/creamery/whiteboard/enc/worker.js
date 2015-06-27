importScripts("/mods/utils/mod-base", "/mods/utils/pattern-matcher");

registerMethod("encode", function(inp, cb){
	cb(inp)
});

registerMethod("postUI", function(data) {
	broadcastMessage([{
		codec: {
			namespace: "creamery",
			type: "whiteboard"
		},
		stream: true,
		content: data,
		fallback: ""
	}]);
})

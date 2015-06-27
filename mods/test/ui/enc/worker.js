importScripts("/mods/utils/mod-base", "/mods/utils/pattern-matcher");

registerMethod("encode", function(inp, cb){
	cb(inp)
});

registerMethod("postUI", function(data) {
	broadcastMessage([{
		codec: {
			namespace: "creamery",
			type: "code"
		},
		content: {
			code: "print 'hello world'"
		},
		fallback: "print 'hello world'"
	}])
})

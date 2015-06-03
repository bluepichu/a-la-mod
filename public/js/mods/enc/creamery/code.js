var searchPattern = /`(.*?)`/;

encode = function(inp, cb){
	var out = [];
	for(var i = 0; i < inp.length; i++){
		if(typeof(inp[i]) == "string"){
			var str = inp[i];
			while(str.length > 0){
				var match = str.match(this.searchPattern);
				if(match == null){
					break;
				}
				if(match.index > 0){
					out.push(str.substring(0, match.index));
				}
				out.push({
					codec: {
						namespace: "com.alamod",
						type: "code"
					},
					content: {
						code: match[1]
					},
					fallback: match[1]
				});
				str = str.substring(match.index + match[0].length);
			}
			if(str.length > 0){
				out.push(str);
			}
		} else {
			out.push(inp[i]);
		}
	}
	cb(out);
}

onmessage = function(ev){
	var data = ev.data;
	switch(data.operation){
		case "encode":
			encode(data.options.message, function(output){
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
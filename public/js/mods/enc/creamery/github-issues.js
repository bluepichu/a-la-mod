var searchPattern = /github:(.*?)\/(.*?)\s#?(\d+)/;

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
						namespace: "com.alamod.github",
						type: "issue"
					},
					content: {
						owner: match[1],
						repo: match[2],
						issue: parseInt(match[3])
					},
					fallback: match[1] + "/" + match[2] + " #" + match[3]
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
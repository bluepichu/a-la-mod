function LinksEncoder(){
	this.searchPattern = /\[(.*?)\]\((.*?)\)/;
}

LinksEncoder.prototype.encode = function(inp, cb){
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
						type: "link"
					},
					content: {
						text: match[1],
						url: match[2]
					},
					fallback: match[1] + " (" + match[2] + ")"
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
function LatexEncoder(){
	this.searchPattern = /\$(.*?)\$|\\\((.*?)\\\)/;
}

LatexEncoder.prototype.encode = function(inp, cb){
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
				var eq = match[1];
				if(!eq){
					eq = match[2];
				}
				out.push({
					codec: {
						namespace: "com.alamod",
						type: "latex"
					},
					content: {
						equation: eq
					},
					fallback: eq
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
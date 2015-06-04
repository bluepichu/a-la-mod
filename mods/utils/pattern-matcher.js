importScripts("/mods/utils/async-handler");

matchPattern = function(inp, pattern, func, cb){
	var out = [];
	var ash = new AsyncHandler(function(){
		cb(out);
	});

	for(var i = 0; i < inp.length; i++){
		if(typeof(inp[i]) == "string"){
			var str = inp[i];
			while(str.length > 0){
				var match = str.match(pattern);
				if(match == null){
					break;
				}
				if(match.index > 0){
					out.push(str.substring(0, match.index));
				}
				out.push("");
				ash.attach(func, [match], function(ind){
					return function(data){
						out[ind] = data;
						this.next();
					}
				}(out.length-1));
				str = str.substring(match.index + match[0].length);
			}
			if(str.length > 0){
				out.push(str);
			}
		} else {
			out.push(inp[i]);
		}
	}
	ash.run();
}
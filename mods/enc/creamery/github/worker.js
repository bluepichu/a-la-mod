importScripts("/mods/utils/mod-base", "/mods/utils/pattern-matcher");

var owner = null;
var repo = null;

var regexes = {
	repo: /^\s*([A-Za-z0-9_\.-]*?)\/([A-Za-z0-9_\.-]*?)\s*$/,
	issue: /^\s*(([A-Za-z0-9_\.-]*?)\/([A-Za-z0-9_\.-]*?))?\s*#?(\d*)\s*$/,
	branch: /^\s*(([A-Za-z0-9_\.-]*?)\/([A-Za-z0-9_\.-]*?))?\s*([A-Za-z0-9_\.-]*?)\s*$/
};

registerMethod("encode", function(inp, cb){
	matchPattern(inp.message, /github\[(.*)\]/, function(match, cb){
		var matches = {};

		for(var type in regexes){
			var typeMatch = match[1].match(regexes[type]);
			
			if(typeMatch == null){
				continue;
			}
			
			var content = {};
			var fallback = "";

			switch(type){
				case "repo":
					owner = typeMatch[1];
					repo = typeMatch[2];
					content = {
						owner: owner,
						repo: repo
					};
					fallback = typeMatch[1] + "/" + typeMatch[2];
					break;
				case "issue":
					owner = typeMatch[2] || owner;
					repo = typeMatch[3] || repo;
					content = {
						owner: owner,
						repo: repo,
						issue: typeMatch[4]
					};
					fallback = typeMatch[1] + " #" + typeMatch[4];
					break;
				case "branch":
					owner = typeMatch[2] || owner;
					repo = typeMatch[3] || repo;
					content = {
						owner: owner,
						repo: repo,
						branch: typeMatch[4]
					};
					fallback = typeMatch[1] + " " + typeMatch[4];
					break;
			}

			cb({
				codec: {
					namespace: "creamery.github",
					type: type
				},
				content: content,
				fallback: fallback
			});
			return;
		}

		cb(match[0]);
	}, function(data){
		cb({message: data});
	});
});
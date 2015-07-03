importScripts("/mods/utils/mod-base", "/mods/utils/async-handler", "/mods/utils/pattern-matcher");

var owner = null;
var repo = null;

registerMethod("decode", function(inp, cb){
	inp = inp.message;
	var out = inp.slice(0, inp.length);
	var ash = new AsyncHandler(function(){
		cb({message: out});
	});
	for(var i = 0; i < inp.length; i++){
		if(typeof(inp[i]) == "object" && inp[i].codec !== undefined && inp[i].codec.namespace == "creamery.github"){
			ash.attach(function(inp, cb){
				var xhr = new XMLHttpRequest();

				xhr.onload = function(){
					if(this.status == 200){
						var resp = JSON.parse(this.responseText);
						cb(resp, inp.codec.type);
					} else {
						cb(null, inp.codec.type);
					}
				}
				
				owner = inp.content.owner;
				repo = inp.content.repo;
				
				switch(inp.codec.type){
					case "repo":
						xhr.open("GET", "https://api.github.com/repos/" + inp.content.owner + "/" + inp.content.repo);
						break;
					case "issue":
						xhr.open("GET", "https://api.github.com/repos/" + inp.content.owner + "/" + inp.content.repo + "/issues/" + inp.content.issue, true);
						break;
					case "branch":
						xhr.open("GET", "https://api.github.com/repos/" + inp.content.owner + "/" + inp.content.repo + "/branches/" + inp.content.branch, true);
						break;
					case "commit":
						xhr.open("GET", "https://api.github.com/repos/" + inp.content.owner + "/" + inp.content.repo + "/commits/" + inp.content.hash, true);
						break;
					default:
						cb(null, inp.codec.type);
						return;
				}
				
				xhr.send();
			}, [inp[i]], function(index){
				return function(data, type){
					if(data != null){
						switch(type){
							case "repo":
								out[index] = {type: "SafeString", content: "<a href='" + data.html_url + "' target='_blank'><ala-github type='repo'>" + data.full_name + "</ala-github>", decoder: "creamery/github"};
								break;
							case "issue":
								out[index] = {type: "SafeString", content: "<a href='" + data.html_url + "' target='_blank'><ala-github type='issue' " + data.state + ">#" + data.number + ": " + data.title + "</ala-github>", decoder: "creamery/github"};
								break;
							case "branch":
								out[index] = {type: "SafeString", content: "<a href='" + data.html_url + "' target='_blank'><ala-github type='branch'>" + data.name + "</ala-github>", decoder: "creamery/github"};
								break;
							case "commit":
								out[index] = {type: "SafeString", content: "<a href='" + data.html_url + "' target='_blank'><ala-github type='commit'>" + data.commit.message + " <span class='hash'>(" + data.sha.substring(0, 7) + ")</span></ala-github>", decoder: "creamery/github"};
								break;
						}
					} else {
						out[index] = inp[index].fallback;
					}
					this.next();
				};
			}(i));

		}
	}
	ash.run();
});

var regexes = {
	repo: /^\s*([A-Za-z0-9_\.-]*?)\/([A-Za-z0-9_\.-]*?)\s*$/,
	issue: /^\s*(([A-Za-z0-9_\.-]*?)\/([A-Za-z0-9_\.-]*?))?\s*#?(\d*)\s*$/,
	commit: /^\s*(([A-Za-z0-9_\.-]*?)\/([A-Za-z0-9_\.-]*?))?\s*([0-9a-f]+)\s*$/,
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
					fallback = owner + "/" + repo + "/" + typeMatch[2];
					break;
				case "issue":
					owner = typeMatch[2] || owner;
					repo = typeMatch[3] || repo;
					content = {
						owner: owner,
						repo: repo,
						issue: typeMatch[4]
					};
					fallback = owner + "/" + repo + " #" + typeMatch[4];
					break;
				case "branch":
					owner = typeMatch[2] || owner;
					repo = typeMatch[3] || repo;
					content = {
						owner: owner,
						repo: repo,
						branch: typeMatch[4]
					};
					fallback = owner + "/" + repo + " " + typeMatch[4];
					break;
				case "commit":
					owner = typeMatch[2] || owner;
					repo = typeMatch[3] || repo;
					content = {
						owner: owner,
						repo: repo,
						hash: typeMatch[4]
					};
					fallback = owner + "/" + repo + " " + typeMatch[4];
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
importScripts("/mods/utils/mod-base", "/mods/utils/async-handler");

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
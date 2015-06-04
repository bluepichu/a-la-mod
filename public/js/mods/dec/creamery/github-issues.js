importScripts("/js/mods/utils/creamery/mod-base.js", "/js/mods/utils/creamery/async-handler.js");

registerMethod("decode", function(inp, cb){
	inp = inp.message;
	var out = inp.slice(0, inp.length);
	var ash = new AsyncHandler(function(){
		cb({message: out});
	});
	for(var i = 0; i < inp.length; i++){
		if(typeof(inp[i]) == "object" && inp[i].codec !== undefined && inp[i].codec.namespace == "com.alamod.github" && inp[i].codec.type == "issue"){
			ash.attach(function(owner, repo, issue, cb){
				var xhr = new XMLHttpRequest();

				xhr.onload = function(){
					if(this.status == 200){
						var resp = JSON.parse(this.responseText);
						cb(resp);
					} else {
						cb(null);
					}
				}

				xhr.open("GET", "https://api.github.com/repos/" + owner + "/" + repo + "/issues/" + issue, true);
				xhr.send();
			}, [inp[i].content.owner, inp[i].content.repo, inp[i].content.issue], function(index){
				return function(data){
					if(data != null){
						out[index] = {type: "SafeString", content: "<a href='" + data.html_url + "' target='_blank'><ala-github-issue " + data.state + ">#" + data.number + ": " + data.title + "</ala-github-issue></a>"};
					} else {
						out[index] = inp[i].fallback;
					}
					this.next();
				};
			}(i));

		}
	}
	ash.run();
});
function GithubIssueDecoder(){}

GithubIssueDecoder.prototype.decode = function(inp, cb){
	var out = inp.slice(0, inp.length);
	var ash = new AsyncHandler(function(){
		cb(out);
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
						out[index] = new Handlebars.SafeString("<a href='" + data.html_url + "' target='_blank'><ala-github-issue " + data.state + ">#" + data.number + ": " + data.title + "</ala-github-issue></a>");
					} else {
						out[index] = inp[i].fallback;
					}
					this.next();
				};
			}(i));

		}
	}
	ash.run();
}

// AsyncHandler written by bluepichu.  May become an import at a later point, since this may be published as its own project.
var AsyncHandler = function(done){
	this.asyncCount = 0;
	this.running = false;

	this.run = function(){
		this.running = true;
		if(this.asyncCount == 0){
			done();
		}
	}

	this.attach = function(func, args, cb){
		this.asyncCount++;
		cb = cb.bind({next: this.next.bind(this)});
		args.push(cb);
		func.apply(this, args);
	}

	this.next = function(){
		this.asyncCount--;
		if(this.asyncCount == 0 && this.running){
			done();
		}
	}
}
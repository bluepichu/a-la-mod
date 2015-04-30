function GithubIssueEncoder(){
	this.searchPattern = /github:(.*?)\/(.*?)\s#?(\d+)/;
}

GithubIssueEncoder.prototype.encode = function(inp, cb){
	var out = [];
	var ash = new AsyncHandler(function(){
		cb(out);
	});
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
				out.push({});
				ash.attach(function(user, repo, iss, cb){
					var xhr = new XMLHttpRequest();

					xhr.onload = function(){
						if(this.status == 200){
							var resp = JSON.parse(this.responseText);

							cb({
								title: resp.title,
								number: resp.number,
								state: resp.state,
								assignee: resp.assignee,
								repo: repo,
								owner: user,
								url: resp.html_url
							});
						} else {
							cb({});
						}
					}

					xhr.open("GET", "https://api.github.com/repos/" + user + "/" + repo + "/issues/" + iss, true);
					xhr.send();
				}, [match[1], match[2], match[3]], function(index, match){
					return function(data){
						if(data != null){
							out[index] = {
								codec: {
									namespace: "com.alamod.github",
									type: "issue"
								},
								content: data,
								fallback: match[0]
							};
						} else {
							out[index] = match[0];
						}
						this.next();
					};
				}(out.length-1, match));
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
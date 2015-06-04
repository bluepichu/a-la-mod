AsyncHandler = function(done){
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
function LatexDecoder(){
	this.idCounter = 0;
}

LatexDecoder.prototype.decode = function(inp, cb){
	var out = inp.slice(0, inp.length);
	for(var i = 0; i < inp.length; i++){
		if(typeof(inp[i]) == "object" && inp[i].codec !== undefined && inp[i].codec.namespace == "com.alamod" && inp[i].codec.type == "latex"){
			this.idCounter++;
			out[i] = new Handlebars.SafeString("<ala-latex id='latex-" + this.idCounter + "'>\\(" + inp[i].content.equation + "\\)</ala-latex><script>MathJax.Hub.Queue(['Typeset', MathJax.Hub, 'latex-" + this.idCounter + "']);</script>");
		}
	}
	cb(out);
}
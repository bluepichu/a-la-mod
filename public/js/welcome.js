"use strict";

function welcome(el){
	var options = ["Hey there.", "Howdy.", "Welcome.", "Back for more?"];
	var choice = options[Math.floor(Math.random()*options.length)];
	el.text(choice);
}
ala.mods = {};
ala.mods.methodCounter = 0;
ala.mods.methods = {};
ala.mods.workers = {};
ala.mods.uis = {}

/**
  * A method that takes a message from the user and encodes it based on the mods loaded. It
  *     chains callbacks together to run every mod
  * @param message string   The message sent by the user
  * @param mods    string[] The list of mods to use to encode
  * @param cb      function The callback to use after encoding has occurred
  */

ala.mods.encode = function(message, mods, cb){
	if(message.constructor !== Array){
		message = [message];
	}
	for(var i = 0; i < mods.length; i++){
		if(!(mods[i] in ala.mods.workers)){
			ala.mods.initialize(mods[i]);
		}
	}
	var closure = function(ind){
		return function(data){
			if(ind >= mods.length){
				cb(data.message);
				return;
			}
			ala.mods.execute(mods[ind], "encode", {message: data.message}, closure(ind+1));   
		}
	}

	closure(0)({message: message});
}

/**
  * A method that takes a message from the server and decodes it based on the mods loaded. It
  *     chains callbacks together to run every mod
  * @param message string   The message received from the server
  * @param mods    string[] The list of mods to use to decode
  * @param cb      function The callback to use after decoding has occurred
  */

ala.mods.decode = function(message, mods, cb){
	if(message.constructor !== Array){
		message = [message];
	}
	for(var i = 0; i < mods.length; i++){
		if(!(mods[i] in ala.mods.workers)){
			ala.mods.initialize(mods[i]);
		}
	}
	var closure = function(ind){
		return function(data){
			if(ind >= mods.length){
				cb(data.message);
				return;
			}
			ala.mods.execute(mods[ind], "decode", {message: data.message}, closure(ind+1));
		}
	}

	closure(0)({message: message});
}

/**
  * A wrapper for initialize that sets the modType to be "enc"
  * @param mod     string            The name of the mod to initialize
  * @param options object{modObject} Options for initializing the mod
  */
// DO NOT USE
//ala.mods.initializeEncoder = function(mod, options){
//	if(!options){
//		options = {};
//	}
//	options.modType = "enc";
//	ala.mods.initialize(mod, options);
//}

/**
  * A wrapper for initialize that sets the modType to be "dec"
  * @param mod     string            The name of the mod to initialize
  * @param options object{modObject} Options for initializing the mod
  */
// DO NOT USE
//ala.mods.initializeDecoder = function(mod, options){
//	if(!options){
//		options = {};
//	}
//	options.modType = "dec";
//	ala.mods.initialize(mod, options);
//}

/**
  * Updates the proper mod list (encoders|decoders) with the WebWorker corresdponding to
  *     the mod that needs to be loaded. It also initializes the mod, as well as setting
  *     up the proper event handlers for it
  * @param mod     string            The name of the mod to initialize
  * @param options object{modObject} Options for initializing the mod
  */

ala.mods.initialize = function(mod, options){
	console.log(mod)
	if(!mod){
		console.log("Mod initializeation failed")
		return;
	}
	if(!options){
		options = {};
	}
	if(mod in ala.mods.workers){
		return false;
	}
	ala.mods.workers[mod] = new Worker("/mods/" + mod + "/worker");
	ala.mods.workers[mod].name = mod;
	ala.mods.workers[mod].postMessage({method: "init", options: options});
	ala.mods.workers[mod].onmessage = ala.mods.messageHandler;
	return true;
}

/**
  * Sends the message to a mod (embedded within the options object) and manages proper
  *     execution of callback methods.
  * @param mod     string             The name of the mod to execute
  * @param method  string             The method to perform (encode|decode)
  * @param options object{modOptions} The options for the mod
  * @param cb      function           The callback for executing when the mod is done
  */

ala.mods.execute = function(mod, method, options, cb){
	if(!(mod in ala.mods.methods)){
		ala.mods.methods[mod] = {};
	}
	ala.mods.methods[mod][ala.mods.methodCounter] = {
		method: method,
		mod: mod,
		options: options,
		callback: cb
	}
	ala.mods.workers[mod].postMessage({
		method: method,
		id: ala.mods.methodCounter,
		options: options
	});
	ala.mods.methodCounter++;
}

/**
  * Handles the callbacks by looking up the id in the ala.mods.method namespace
  */

ala.mods.messageHandler = function(ev){
	var options = ev.data;

	if(options.method == "ui.post" && ala.mods.uis[ev.target.name]){
		ala.mods.uis[ev.target.name].postMessage(ev.data, "*")
		return;
	}

	if(options.method == "alm.send" && ala.currentChat){
		ala.socket.emit("message", ala.currentChat, options.message)
		return;
	}
	ala.mods.methods[ev.target.name][options.requestId].callback(options.output);
	delete ala.mods.methods[ev.target.name][options.requestId];
}

ala.mods.registerUI = function(name, nwindow){	
	ala.mods.uis[name] = nwindow;
	nwindow.postMessage({method:"init"}, "*")
}

ala.mods.uiHandler = function(e) {
	if (e.data && e.data.method == "mod.post" && e.data.name) { //TODO: make this not bad so that ui's cannot send messages to other workers
		ala.mods.workers[e.data.name].postMessage({
			method: "mod.post",
			options: e.data
		})
	}
}

window.onmessage = ala.mods.uiHandler
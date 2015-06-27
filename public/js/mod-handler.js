ala.mods = {};
ala.mods.methodCounter = 0;
ala.mods.methods = {};
ala.mods.encoders = {};
ala.mods.decoders = {};
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
		message = [message]
	}
	for(var i in mods){
		if (mods[i].encoder) {
			ala.mods.initializeEncoder(i);
		}
	}
	var closure = function(ind){
		return function(data){
			var k = Object.keys(mods)
			if(ind >= k.length){
				cb(data.message);
				return;
			}
			if (!mods[k[ind]].encoder) {
				closure(ind+1)({message:data.message})
				return;
			}
			ala.mods.execute(k[ind], "enc", "encode", {message: data.message}, closure(ind+1));
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
		message = [message]
	}
	for(var i in mods){
		if (mods[i].decoder) {
			ala.mods.initializeDecoder(i);
		}
	}
	var closure = function(ind){
		return function(data){
			var k = Object.keys(mods)
			if(ind >= k.length){
				cb(data.message);
				return;
			}
			if (!mods[k[ind]].decoder) {
				closure(ind+1)({message:data.message})
			}
			ala.mods.execute(k[ind], "dec", "decode", {message: data.message}, closure(ind+1));
		}
	}
	
	closure(0)({message: message});
}

 /**
  * A wrapper for initialize that sets the modType to be "enc"
  * @param mod     string            The name of the mod to initialize
  * @param options object{modObject} Options for initializing the mod
  */

ala.mods.initializeEncoder = function(mod, options){
	if(!options){
		options = {};
	}
	options.modType = "enc";
	ala.mods.initialize(mod, options);
}

 /**
  * A wrapper for initialize that sets the modType to be "dec"
  * @param mod     string            The name of the mod to initialize
  * @param options object{modObject} Options for initializing the mod
  */

ala.mods.initializeDecoder = function(mod, options){
	if(!options){
		options = {};
	}
	options.modType = "dec";
	ala.mods.initialize(mod, options);
}

 /**
  * Updates the proper mod list (encoders|decoders) with the WebWorker corresdponding to
  *     the mod that needs to be loaded. It also initializes the mod, as well as setting
  *     up the proper event handlers for it
  * @param mod     string            The name of the mod to initialize
  * @param options object{modObject} Options for initializing the mod
  */

ala.mods.initialize = function(mod, options){
	if(!mod || !options){
		throw "Mod Initialization Error: mod or options not specified.";
	}
	var addTo;
	switch(options.modType){
		case "enc":
			addTo = ala.mods.encoders;
			break;
		case "dec":
			addTo = ala.mods.decoders;
			break;
		default:
			throw "Mod Initialization Error: invalid modType.";
	}
	if(mod in addTo){
		return false;
	}
	addTo[mod] = new Worker("/mods/" + options.modType + "/" + mod + "/worker");
	addTo[mod].modType = options.modType;
	addTo[mod].name = mod;
	delete options["modType"];
	addTo[mod].postMessage({method: "init", options: options});
	addTo[mod].onmessage = ala.mods.messageHandler;
	return true;
}

 /**
  * Sends the message to a mod (embedded within the options object) and manages proper
  *     execution of callback methods.
  * @param mod     string             The name of the mod to execute
  * @param modType string             The type of mod (enc|dec)
  * @param method  string             The method to perform (encode|decode)
  * @param options object{modOptions} The options for the mod
  * @param cb      function           The callback for executing when the mod is done
  */

ala.mods.execute = function(mod, modType, method, options, cb){
	var searchIn;
	switch(modType){
		case "enc":
			searchIn = ala.mods.encoders;
			break;
		case "dec":
			searchIn = ala.mods.decoders;
			break;
		default:
			throw "Mod Initialization Error: invalid modType.";
	}
	if(!((modType + " " + mod) in ala.mods.methods)){
		ala.mods.methods[modType + " " + mod] = {};
	}
	ala.mods.methods[modType + " " + mod][ala.mods.methodCounter] = {
		method: method,
		mod: mod,
		modType: modType,
		options: options,
		callback: cb
	}
	searchIn[mod].postMessage({
		method: method,
		id: ala.mods.methodCounter++,
		options: options
	});
}

 /**
  * Handles the callbacks by looking up the id in the ala.mods.method namespace
  */

ala.mods.messageHandler = function(ev){
	var options = ev.data;
	if (options.method == "postUI" && ala.mods.uis[ev.target.name] && ev.target.modType == "dec") {
		ala.mods.uis[ev.target.name].postMessage(ev.data, "*")
		return;
	}
	if (options.method == "broadcast" && ev.target.modType == "enc" && ala.currentChat) {
		ala.socket.emit("message", ala.currentChat, options.message)
		return;
	}
	ala.mods.methods[ev.target.modType + " " + ev.target.name][options.requestId].callback(options.output);
	delete ala.mods.methods[ev.target.modType + " " + ev.target.name][options.requestId];
}

ala.mods.registerUI = function(name, nwindow) {	
	ala.mods.uis[name] = nwindow;
	nwindow.postMessage({method:"init"}, "*")
}

ala.mods.uiHandler = function(e) {
	if (e.data && e.data.method == "send" && e.data.name) { //TODO: make this not bad so that ui's cannot send messages to other workers
		ala.mods.encoders[e.data.name].postMessage({
			method: "postUI",
			options: e.data
		})
	}
}

window.onmessage = ala.mods.uiHandler

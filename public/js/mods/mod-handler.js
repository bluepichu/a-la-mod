ala.mods = {};
ala.mods.operationCounter = 0;
ala.mods.operations = {};
ala.mods.encoders = {};
ala.mods.decoders = {};

ala.mods.encode = function(message, mods, cb){
	if(message.constructor !== Array){
		message = [message]
	}
	var closure = function(ind){
		return function(data){
			if(ind >= mods.length){
				cb(data.message);
				return;
			}
			ala.mods.execute(mods[ind], "enc", "encode", {message: data.message}, closure(ind+1));
		}
	}
	
	closure(0)({message: message});
}

ala.mods.decode = function(message, mods, cb){
	if(message.constructor !== Array){
		message = [message]
	}
	var closure = function(ind){
		return function(data){
			if(ind >= mods.length){
				cb(data.message);
				return;
			}
			ala.mods.execute(mods[ind], "dec", "decode", {message: data.message}, closure(ind+1));
		}
	}
	
	closure(0)({message: message});
}

ala.mods.initializeEncoder = function(mod, options){
	if(!options){
		options = {};
	}
	options.modType = "enc";
	ala.mods.initialize(mod, options);
}

ala.mods.initializeDecoder = function(mod, options){
	if(!options){
		options = {};
	}
	options.modType = "dec";
	ala.mods.initialize(mod, options);
}

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
		throw "Mod Initialization Error: mod is already initialized, or naming conflict exists.";
	}
	addTo[mod] = new Worker("/js/mods/" + options.modType + "/" + mod + ".js");
	delete options["modType"];
	addTo[mod].postMessage({operation: "init", options: options});
	addTo[mod].onmessage = ala.mods.messageHandler;
}

ala.mods.execute = function(mod, modType, operation, options, cb){
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
	ala.mods.operations[ala.mods.operationCounter] = {
		operation: operation,
		mod: mod,
		modType: modType,
		options: options,
		callback: cb
	}
	searchIn[mod].postMessage({
		operation: operation,
		id: ala.mods.operationCounter++,
		options: options
	});
}

ala.mods.messageHandler = function(ev){
	var options = ev.data;
	ala.mods.operations[options.requestId].callback(options.output);
	delete ala.mods.operations[options.requestId];
}
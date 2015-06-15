# Mod Creation Guide

Mods are meant to be as easy as possible to use, but we understand that the API can be confusing.  Thus, we provide this short guide to making mods.  It is by no means exhaustive, and clearly does not replace the entire API.

## Importing

Several common mod tools have been already written.  They can be found by importing `/mods/utils/creamery/<name>`.  The most useful of these is `mod-base.js`, which it is strongly recommended that you always import.  The remainder of this document will assume that you have imported that already.

## Encoding

An encoding mod will usually take in strings and split them when a certain pattern satisfying the mod is found.  A shorthand form of this, found in the `pattern-matcher.js` utility, is useful for producing encoding mods for this reason.

Example:

```js
importScripts("/mods/utils/mod-base", "/mods/utils/pattern-matcher");

registerMethod("encode", function(inp, cb){
	matchPattern(inp.message, /<regex>/, function(match, cb){
		cb({
			codec: {
				namespace: "<developer name>",
				type: "<codec name>"
			},
			content: {
				<content>
			},
			fallback: <fallback text content>
		});
	}, function(data){
		cb({message: data});
	});
});
```

## Decoding

An decoding mod will usually take in the message, search for pieces with a compatible codec, and decode them to strings.

Example:

```js
importScripts("/mods/utils/mod-base");

registerMethod("decode", function(inp, cb){
	inp = inp.message;
	var out = inp.slice(0, inp.length);
	for(var i = 0; i < inp.length; i++){
		if(typeof(inp[i]) == "object" && inp[i].codec !== undefined && inp[i].codec.namespace == "<developer name>" && inp[i].codec.type == "<codec name>"){
			out[i] = <text content>;
		}
	}
	cb({message: out});
});
```

Note that if the text content contains HTML, you must escape it in a SafeString.  You can do this by returning `{type: "SafeString", content: <content>}` instead of a string.
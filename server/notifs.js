"use strict";

var https = require("https");
var db = require("./db");
var logger = require("./logger");

module.exports = function(){
	db.createCollection("push");
}

function removeKey(email, subId){
	return db.update("push", {email: email}, {$pull: {subId: subId}});
}

function addKey(email, subId){
	return db.find("push", {email: email})
		.then(function(docs){
		if(docs.length != 1){
			return Promise.reject("Email not found or duplicate email.");
		}
		if(docs[0].subId.indexOf(subId) < 0){
			return db.update("push", {email: email}, {$push: {subId: subId}});
		}
	});
}
function sendMessage(email, message){
	db.find("push", {email: email})
		.then(function(docs){
		if(docs.length != 1){
			return Promise.reject("Email not found or duplicate email.");
		}
		var keys = JSON.stringify(docs[0].subId);
		return db.update("push", {email: email}, {$set: {message: message}});
	})
		.then(function(docs){
		if(docs.length != 1){
			return Promise.reject("No updates.");
		}

		var options = {
			hostname: 'android.googleapis.com',
			port: 443,
			path: '/gcm/send',
			method: 'POST',
			headers: {
				"Content-Type" :"application/json",
				"Authorization": "key=AIzaSyDXd3IVhR0fRLPZPr6BQAXg7Pup8cUD_GY"
			}
		};

		var req = https.request(options, function(res){
			logger.log("statusCode: ", res.statusCode);
			logger.log("headers: ", res.headers);

			res.on('data', function(d){
				process.stdout.write(d);
			});
		});
		
		req.write("{\"registration_ids\":" + keys + "}")
		req.end();

		req.on('error', function(e) {
			logger.error(e);
		});
	});
}

var getMessage = function(subId) {
	db.find("push", {subId: subId})
		.then(function(docs){
		if(docs.length != 1){
			return Promise.reject("Message not found.");
		}
		return Promise.resolve(docs[0].message);
	})
}

module.exports.prototype = {
	getMessage: getMessage,
	sendMessage: sendMessage,
	addKey: addKey,
	removeKey: removeKey
}

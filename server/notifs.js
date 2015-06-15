var https = require("https")
module.exports = function(mongo) {
	this._db = mongo["push"];
	console.log(mongo.push)
}

function removeKey(email, subId, cb) {
	this._db.update({email: email}, {$pull: {subId: subId}},
	(cb ? cb : function() {}))
	return;
}
function addKey(email, subId, cb) {
	var that = this
	this._db.find({email: email}, function(err,docs) {
		if (err) {
			cb(err);
		}
		if (docs.length == 0) {
			that._db.insert({
				email: email,
				subId: [subId],
				message: {"title": "error", "body": "error"},
			}, (cb ? cb : function(){}))
			return;
		}
		if (docs.length > 1) {
			if (cb) cb("Too Many")
			return;
		}
		if (docs[0].subId.indexOf(subId) < 0) {
			that._db.update({email: email}, {$push: {subId: subId}},
			(cb ? cb : function() {}))
			return;
		}
	})
}
function sendMessage(email, message, cb) {
	var that = this;
	this._db.find({email: email}, function(err, docs) {
		if (err) {
			cb(err);
			return;
		}
		if (docs.length == 0 || docs.length > 1) {
			cb(false);
			return;
		}
		var keys = JSON.stringify(docs[0].subId)
		that._db.update({email: email}, {$set: {message: message}}, function(err, docs) {
			if (err) {
				cb(err);
				return;
			}
			if (docs.length == 0 || docs.length > 1) {
				cb(false);
				return;
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

			var req = https.request(options, function(res) {
				console.log("statusCode: ", res.statusCode);
				console.log("headers: ", res.headers);

				res.on('data', function(d) {
					process.stdout.write(d);
				});
			});
			req.write("{\"registration_ids\":"+keys+"}")
			req.end();

			req.on('error', function(e) {
				console.error(e);
			});	
			cb(true)
		})
	})
}

var getMessage = function(subId, cb) {
	this._db.find({subId: subId}, function(err, docs) {
		if (err) {
			cb(err);
			return;
		}
		if (docs.length == 0 || docs.length > 1) {
			cb(false);
			return;
		}
		cb(null, docs[0].message)
	})
}

module.exports.prototype = {
	getMessage: getMessage,
	sendMessage: sendMessage,
	addKey: addKey,
	removeKey: removeKey,
}

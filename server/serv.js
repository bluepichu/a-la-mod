"use strict";

// Node imports
var express = require("express");
var app = express();
var bodyparser = require("body-parser");
app.use(bodyparser.json());
var cookieparser = require("cookie-parser");
app.use(cookieparser());
var http = require("http").Server(app);
var io = require("socket.io")(http);
var path = require("path");
var fs = require("fs");
var crypto = require("crypto");
var db = require("./db");
var pushObj = require("./notifs");
var logger = require("./logger");
var push = new pushObj(db.db);
var ObjectId = db.ObjectId;
var moment = require("moment");
var emailValidator = require("email-validator");
var cryptoString = require("random-crypto-string");
var mkdirpCB = require("mkdirp");
var sass = require("node-sass");
var globCB = require("glob")

var Promise = require("promise");
var readFile = Promise.denodeify(fs.readFile);
var glob = Promise.denodeify(globCB);
var mkdirp = Promise.denodeify(mkdirpCB);

var morgan = require("morgan");
app.use(morgan("dev"));

var nconf = require("nconf");
nconf.argv().env();

var connect_handlebars = require("connect-handlebars");
app.use("/templates/templates.js", connect_handlebars(__dirname + "/../public/templates", {
	exts: ["hbs"]
}));

var HASH_COUNT = 2;  // Number of times passwords are hashed.  DO NOT CHANGE, AS IT WILL BREAK OLD ACCOUNTS.
var PAGE_SIZE = 40;  // Number of chat results to return in a single request.

var SOCKETS = {}; // Stores currently authorized sockets, as {<user id>: [<list of connected sockets authorized with user id>]}

var PORT = nconf.get("port") || 1337; // Sets the socket to whatever the evironment specifies, or 1337 if a port is not specified
var DEBUG = nconf.get("debug"); // Sets the server in debug mode, serving unminified HTML/CSS/JS
var ROOT = DEBUG ? "../build-dev" : "../build"; // The root directory for serving public files

logger.info("Starting with root", ROOT);

var sendgridlogin = require("sendgrid");
var sendgrid = undefined;

var local = false;

var email = require("./email");

var RESPONSE_MESSAGES = {
	INVALID_CREDENTIALS: "Invalid credentials.",
	SERVER_ERROR: "The server failed to process your request.  Try again in a minute.",
	NOT_AUTHORIZED: "You're not authorized to perform that action.  Make sure you're logged in.",
	NOT_VERIFIED: "You need to verify your email before you perform that action.",
	NOT_AN_EMAIL: "The specified email is not valid.",
	EMAIL_IN_USE: "That email is already in use.", // I feel like this is problematic
	PASSWORD_RESET: "Your password has been reset.  Check your email for the new password."
};

var stub;
readFile(__dirname + "/templates/notif-stubs.template", "utf8")
	.then(function(data){
	stub = data;
})
	.catch(function(err){
	logger.error(err);
});

if(nconf.get("SGPASS")){
	sendgrid = sendgridlogin("a-la-mod", nconf.get("SGPASS"));
} else {
	logger.warn("Missing SGPASS environment variable. Will not be able to verify email addresses.");
}


db.clear("mods")
	.then(function(){
	return glob(path.join(__dirname,"../mods/*/*/manifest.json"), {});
})
	.then(function(manifests){
	return Promise.all(manifests.map(function(manifest){
		return readFile(manifest, "utf8");
	}));
})
	.then(function(manifests){
	return manifests.map(function(manifest){
		manifest = JSON.parse(manifest);
		return db.insert("mods", manifest);
	});
})
	.catch(function(err){
	logger.error(err.stack);
});

app.get("/push/:email/:title/:body", function(req, res) {
	push.sendMessage(req.params.email, {title: req.params.title, body: req.params.body});
	res.send("Tried");
})

app.get("/push/get/:subId", function(req, res) {
	push.getMessage(req.params.subId)
		.then(function(data){
		res.type("application/json")
		res.json(response)
	})
		.catch(function(err){
		logger.error(err.stack);
		res.send(500);
	});
})

/**
 * Serves the À la Mod page.
 */
app.get("/", function(req, res){
	res.sendFile("/index.html", {root: path.join(__dirname, ROOT)});
});

/**
 * Serves the requested CSS file.
 */
app.get("/css/:file", function(req, res){
	res.sendFile("/css/" + req.params.file, {root: path.join(__dirname, ROOT)});
});

/**
 * Serves the requested font file.
 */
app.get("/fonts/:file", function(req, res){
	res.sendFile("/fonts/" + req.params.file, {root: path.join(__dirname, ROOT)});
});

/**
 * Serves the requested JS file.
 */
app.get("/js/*", function(req, res){
	res.sendFile("/js/" + req.params[0], {root: path.join(__dirname, ROOT)});
});

app.get("/service-worker.js", function(req, res) {
	res.sendFile("/service-worker.js", {root: path.join(__dirname, ROOT)})
})
/**
 * Serves the requested JS mod enconder file.
 */
app.get("/js/mods/enc/:file", function(req, res){
	res.sendFile("/js/mods/enc/" + req.params.file, {root: path.join(__dirname, ROOT)});
});

/**
 * Serves the requested JS mod decoder file.
 */
app.get("/js/mods/dec/:file", function(req, res){
	res.sendFile("/js/mods/dec/" + req.params.file, {root: path.join(__dirname, ROOT)});
});

/**
 * Serves the requested image file.
 */
app.get("/images/:file", function(req, res){
	res.sendFile("/images/" + req.params.file, {root: path.join(__dirname, ROOT)});
});

/**
 * Serves the requested static file.
 */
app.get("/static/:file", function(req, res){
	res.sendFile("/static/" + req.params.file, {root: path.join(__dirname, ROOT)});
});

/**
 * Returns the public data about a user.
 */
app.get("/user/:email", function(req, res){
	db.query("users", {email: req.params.email})
		.then(function(data){
		if(data.length != 1){
			res.status(400);
			res.json({
				error: RESPONSE_MESSAGES.INVALID_CREDENTIALS
			})
			return;
		}
		data = data[0];
		res.json({
			email: data.email,
			_id: data._id,
			screenName: data.screenName
		})
	})
		.catch(function(err){
		logger.error(err.stack);
		res.status(500);
		res.json({
			error: RESPONSE_MESSAGES.SERVER_ERROR
		})
		return;
	});
});

app.get("/user/verify/:verID", function(req, res){
	db.query("users", {verificationID: req.params.verID})
		.then(function(data){
		if(data.length != 1){
			res.status(400);
			res.send(renderTemplate("No user with this verification ID found.")); //TODO: make prettier
			return;
		}
		if(data[0].verified){
			res.status(200);
			res.send(renderTemplate("User already verified!"));
			return;
		}
		return db.update("users", {verificationID: req.params.verID}, {"$set": {verified: true}});
	})
		.then(function(data){
		res.status(201);
		res.send(renderTemplate("User verified!"));
	})
		.catch(function(err){
		logger.error(err.stack);
		res.status(500);
		res.json({
			error: RESPONSE_MESSAGES.SERVER_ERROR
		})
	});
});


app.get("/user/reset/:resetID", function(req, res) {
	var userPrm = db.query("users", {resID: req.params.resetID});
	var pwPrm = cryptoString(12);

	var resetPrm = Promise.all([userPrm, pwPrm])
	.then(function(data){
		var user = data[0];
		var pw = data[1];
		if(user.length != 1){
			res.status(400);
			res.send(renderTemplate("No user with this reset ID found"));
			return;
		}
		user = user[0];
		var hash = passwordHash(password, user.salt);
		return db.update("users", {email: user.email}, {$set: {password: hash}});
	});

	Promise.all([userPrm, pwPrm, resetPrm])
		.then(function(data){
		res.status(200);
		res.send(renderTemplate("Your password has been reset to: " + password + ". Please remember to change your password the next time you log in."));
		if (!sendgrid) {
			logger.error("Can't send reset email");
		}
		email.sendEmail(
			sendgrid,
			user.email,
			{
				html: email.createEmail(user.email.split("@")[0], "Your password has been reset to: "+password+". Please remember to change your password the next time you log in."),
				subject: "Your A la Mod password has been reset"
			}
		)
		return db.update("users", {resID: req.params.resetID}, {$unset: {resID: ""}});
	})
		.catch(function(err){
		logger.error(err.stack);
		res.status(500);
		res.json({
			error: RESPONSE_MESSAGES.SERVER_ERROR
		})
	});
});

app.post("/user/notifs/register", function(req, res) {
	var chk = argCheck(req.body, {email: "string", auth: "string", subscriptionId: "string", shouldAdd: "boolean"})
	if(!chk.valid){
		res.status(400);
		res.json({
			error: chk.error
		})
		return;
	}
	db.query("users", {
		email: req.body.email, 
		authTokens: {
			$in: [req.body.auth]
		}})
		.then(function(data){
		if(data.length != 1){
			res.status(400);
			res.json({
				error: RESPONSE_MESSAGES.NOT_AUTHORIZED
			})
			return;
		}

		if(!data[0].verified){
			res.status(400);
			res.json({
				error: RESPONSE_MESSAGES.NOT_VERIFIED
			})
			return;
		}

		if(req.body.shouldAdd){
			return push.addKey(req.body.email, req.body.subscriptionId);
		} else {
			return push.removeKey(req.body.email, req.body.subscriptionId);
		}
	})
		.catch(function(err){
		logger.error(err.stack);
		res.status(500);
		res.json({
			error: RESPONSE_MESSAGES.SERVER_ERROR
		})
	});
});

/**
 * Creates a new user.  Parameters are provided in the POST request as a JSON object.
 */
app.post("/user/new", function(req, res){
	var chk = argCheck(req.body, {email: "string", password: "string"});
	if(!chk.valid){
		res.status(400);
		res.json({
			error: chk.error
		})
		return;
	}

	if(!emailValidator.validate(req.body.email)){
		res.status(400);
		res.json({
			error: RESPONSE_MESSAGES.NOT_AN_EMAIL
		})
		return;
	}

	db.query("users", {email: req.body.email})
		.then(function(data){
		if(data.length > 0){
			res.status(400);
			res.json({
				error: RESPONSE_MESSAGES.EMAIL_IN_USE
			})
			return;
		}

		var salt = crypto.randomBytes(32).toString("base64");
		var password = passwordHash(req.body.password, salt);

		var verId = crypto.randomBytes(16).toString("hex");
		var email = req.body.email;
		var user = req.body.email;
		var color = ["#F44336", "#E91E63", "#9C27B0", "#673AB7", "#3F51B5", "#2196F3", "#03A9F4", "#00BCD4", "#009688", "#4CAF50", "#8BC34A", "#CDDC39", "#FFEB3B", "#FFC107", "#FF9800", "#FF5722", "#795548", "#9E9E9E", "#607D8B"]
		var insPrm = db.insert("users", {
			email: req.body.email,
			password: password,
			salt: salt,
			authTokens: [],
			screenName: req.body.email,
			verificationID: verId,
			verified: false || local,
			contacts: [req.body.email],
			color: color[Math.floor(Math.random()*(color.length-1))]
		});

		return Promise.all([insPrm, Promise.resolve([verId, email, user])]);
	})
		.then(function(data){
		var verId = data[1][0];
		var email = data[1][1];
		var user = data[1][2];

		res.status(200);
		res.json({
			result: "ok"
		})
		if(!local){
			sendVerEmail(verId, email, user);
		}
	})
		.catch(function(err){
		logger.error(err.stack);
		res.status(500);
		res.json({
			error: RESPONSE_MESSAGES.SERVER_ERROR
		})
	});
});

/**
 * Authorizes a user and provides them with an auth token.  Parameters are provided in the POST request as a JSON object.
 */
app.post("/user/auth", function(req, res){
	var chk = argCheck(req.body, {email: "string", password: "string"});
	if (!chk.valid) {
		res.status(400);
		res.json({
			error: chk.error
		})
		return;
	}

	db.query("users", {email: req.body.email})
		.then(function(data){
		if(data.length != 1){
			res.status(400);
			res.json({
				error: RESPONSE_MESSAGES.INVALID_CREDENTIALS
			})
			return;
		}
		if(passwordHash(req.body.password, data[0].salt) != data[0].password){
			res.status(400);
			res.json({
				error: RESPONSE_MESSAGES.INVALID_CREDENTIALS
			})
			return;
		}

		// issue auth token
		var token = crypto.randomBytes(256).toString("base64");
		res.status(200);
		res.json({
			token: token
		})

		db.update("users", {
			email: data[0].email
		}, {
			$push: {authTokens: token}
		});
	})
		.catch(function(err){
		logger.error(err.stack);
		res.status(500);
		res.json({
			error: RESPONSE_MESSAGES.SERVER_ERROR
		})
		return;
	});
});

/**
 * Creates a new chat.  Parameters are provided in the POST request as a JSON object.
 */
app.post("/chat/new", function(req, res){
	var chk = argCheck(req.body, {email: "string", authToken: "string", title: "string", users: "object"});
	if(!chk.valid) {
		res.status(400);
		res.json({
			error: chk.error
		})
		return;
	}

	var userPrm = db.query("users", {
		email: req.body.email, 
		authTokens: {
			$in: [req.body.authToken]
		}
	})
	.then(function(data){
		if(data.length != 1){
			res.status(400);
			res.json({
				error: RESPONSE_MESSAGES.NOT_AUTHORIZED
			})
			return;
		}

		logger.log(JSON.stringify(data[0]));

		if(!data[0].verified){
			res.status(400);
			res.json({
				error: RESPONSE_MESSAGES.NOT_VERIFIED
			})
			return;
		}
		return fetchUserList(req.body.users, "email");
	});

	var insertPrm = userPrm.then(function(users){
		var lastRead = {};

		for(var i = 0; i < users.length; i++){
			lastRead[users[i]._id] = 0;
		}

		return db.insert("chats", {
			users: users.map(function(el){ return el._id; }),
			title: req.body.title,
			messages: [],
			lastRead: lastRead,
			messageCount: 0,
			starred: [],
			creationTime: moment().unix()
		});
	});

	Promise.all([userPrm, insertPrm])
		.then(function(data){
		var users = data[0];
		var chat = data[1];

		for(var i = 0; i < users.length; i++){
			db.update("users", {_id: ObjectId(users[i]._id)}, {$addToSet: {contacts: {$each: req.body.users}}});
			if(users[i]._id in SOCKETS){
				for(var j = 0; j < SOCKETS[users[i]._id].length; j++){
					SOCKETS[users[i]._id][j].join(chat._id);
				}
			}
		}

		io.to(chat._id).emit("new chat", {
			_id: chat._id,
			title: chat.title,
			users: users.map(function(el){return {_id: el._id, email: el.email, screenName: el.screenName}; })
		});

		res.status(200);
		res.json({
			result: "ok"
		})
	})
		.catch(function(err){
		logger.error(err.stack);
		res.status(500);
		res.json({
			error: RESPONSE_MESSAGES.SERVER_ERROR
		})
	})
});

/**
 * Updates a user's information.  Parameters are provided in the POST request as a JSON object.
 */
app.post("/user/update", function(req, res){
	var chk = argCheck(req.body, {email: "string", password: "string", updates: "object"});
	if(!chk.valid) {
		res.status(400);
		res.json({
			error: chk.error
		})
		return;
	}

	var updateObj = {};
	if(req.body.updates.password){
		updateObj.salt = crypto.randomBytes(32).toString("base64");
		updateObj.password = passwordHash(req.body.updates.password, updateObj.salt);
		updateObj.authTokens = [];
	}
	if(req.body.updates.screenName){
		updateObj.screenName = req.body.updates.screenName;
	}
	if(req.body.updates.color){
		updateObj.color = req.body.updates.color;
	}

	db.query("users", {email: req.body.email})
		.then(function(data){
		if(data.length != 1){
			res.status(400);
			res.json({
				error: RESPONSE_MESSAGES.INVALID_CREDENTIALS
			})
			return;
		}
		return db.update("users", {
			email: req.body.email,
			password: passwordHash(req.body.password, data[0].salt)
		}, {
			$set: updateObj
		});
	})
		.then(function(data){
		if(data.n == 0){
			res.status(400);
			res.json({
				error: RESPONSE_MESSAGES.INVALID_CREDENTIALS
			})
			return;
		}
		res.status(200);
		res.send("Ok.");
	})
		.catch(function(err){
		logger.error(err.stack);
		res.status(500);
		res.json({
			error: RESPONSE_MESSAGES.SERVER_ERROR
		})
	});
});

/**
 * Sends a password recovery email to the specified address.
 */
app.post("/user/reset-password", function(req, res){
	var chk = argCheck(req.body, {email: "string"});
	if(!chk.valid) {
		res.status(400);
		res.json({
			error: chk.error
		})
		return;
	}

	db.query("users", {email: req.body.email})
		.then(function(data){
		if(data.length != 1){
			res.status(400);
			res.json({
				error: RESPONSE_MESSAGES.INVALID_CREDENTIALS
			})
			return;
		}

		return Promise.all([Promise.resolve(crypto.randomBytes(16).toString("hex")), db.update("users", {email: req.body.email}, {$set: {resID: resID}})]);
	})
		.then(function(data){
		res.status(200);
		res.json({
			result: RESPONSE_MESSAGES.PASSWORD_RESET
		})
		if (!sendgrid) {
			logger.error("Error, can't send reset email");
			return
		}
		email.sendEmail(
			sendgrid,
			req.body.email,
			{
				html: email.createEmail(req.body.email.split("@")[0], "You recently requested to change your password. If you still wish to do so, please click <a href='http://a-la-mod.com/user/reset/" + resID + "'>here</a>. If you did not request this, you may safely ignore this message."),
				subject: "A la Mod password reset"
			}
		)
	})
		.catch(function(err){
		logger.error(err.stack);
		res.status(500);
		res.json({
			error: RESPONSE_MESSAGES.SERVER_ERROR
		})
		return;
	});
});

/**
 * Returns a list of chats for the current user.  Parameters are provided in the POST request as a JSON object.
 */
app.get("/chats", function(req, res){
	var chk = argCheck({
		email: req.cookies.email,
		authToken: req.cookies.authToken
	}, {
		email: "string",
		authToken: "string"
	});
	if(!chk.valid){
		res.status(400);
		res.json({
			error: chk.error
		})
		return;
	}

	var userChatsPrm = db.query("users", {
		email: req.cookies.email,
		authTokens: {$in: [req.cookies.authToken]}
	})
	.then(function(data){
		if(data.length != 1){
			res.status(400);
			res.json({
				error: RESPONSE_MESSAGES.NOT_AUTHORIZED
			})
			return;
		}
		data = data[0];
		var chatsPrm = db.project("chats", {
			users: {$in: [data._id]}
		}, {
			_id: 1,
			messages: {$slice: [-1, 1]},
			users: 1,
			lastRead: 1,
			messageCount: 1,
			creationTime: 1,
			title: 1,
			starred: 1
		});

		return Promise.all([Promise.resolve(data), chatsPrm]);
	});

	var userListsPrm = userChatsPrm.then(function(data){
		var user = data[0];
		var chats = data[1];

		var loading = [];

		for(var i = 0; i < chats.length; i++){
			var starred = false;
			for(var j = 0; j < chats[i].starred.length; j++){
				if(chats[i].starred[j].toString() == user._id){
					starred = true;
					break;
				}
			}
			chats[i].starred = starred;
			loading.push(fetchUserList(chats[i].users.map(function(el){ return ObjectId(el); }), "_id"));
		}

		return Promise.all(loading);     
	})

	Promise.all([userChatsPrm, userListsPrm])
		.then(function(data){
		var user = data[0][0];
		var chats = data[0][1];
		var userLists = data[1];

		for(var i = 0; i < chats.length; i++){
			chats[i].users = userLists[i].map(function(el){return {_id: el._id, email: el.email, screenName: el.screenName}; });
			if(chats[i].messages.length > 0){
				for(var j = 0; j < userLists[i].length; j++){
					if(userLists[i][j]._id.toString() == chats[i].messages[0].sender.toString()){
						chats[i].messages[0].sender = userLists[i][j].screenName;
						break;
					}
				}
			}
		}

		return Promise.resolve(chats);
	})
		.then(function(data){
		res.status(200);
		res.send(data);
	})
		.catch(function(err){
		logger.error(err.stack);
		res.status(500);
		res.json({
			error: RESPONSE_MESSAGES.SERVER_ERROR
		})
	});
});

/**
 * Returns a list of previous messages for a given chat.  Parameters are provided in the POST request as a JSON object.
 */
app.get("/chat/:chatId/history/:page?", function(req, res){
	var params = {
		email: req.cookies.email,
		authToken: req.cookies.authToken,
		chatId: req.params.chatId
	}
	if(req.params.page){
		params.page = parseInt(req.params.page);
	}
	var chk = argCheck(params, {
		chatId: "string",
		email: "string",
		authToken: "string",
		page: {type: "number", optional: true}
	});
	if(!chk.valid){
		res.status(400);
		res.json({
			error: chk.error
		})
		return;
	}

	var page = 0;
	if(params.page){
		page = params.page;
	}

	var userChatPrm = db.query("users", {
		email: params.email,
		authTokens: {$in: [params.authToken]}
	})
	.then(function(data){
		if(data.length != 1){
			res.status(400);
			res.json({
				error: RESPONSE_MESSAGES.NOT_AUTHORIZED
			})
			return;
		}

		data = data[0];

		var chatPrm = db.project("chats", {
			_id: ObjectId(params.chatId),
			users: {$in: [ObjectId(data._id)]}
		}, {
			messages: {$slice: [-(page+1)*PAGE_SIZE, PAGE_SIZE]},
			messageCount: 1
		})
		.then(function(data){
			if(data.length != 1){
				res.status(400);
				res.json({
					error: RESPONSE_MESSAGES.INVALID_CHAT_ID
				})
				return;
			}

			return data[0];
		});

		return Promise.all([Promise.resolve(data), chatPrm]);
	});

	var userListPrm = userChatPrm.then(function(data){
		var user = data[0];
		var chat = data[1];

		if(page*PAGE_SIZE > chat.messageCount){
			res.status(200).send({title: chat.title, messages: []});
			return;
		} else if((page+1)*PAGE_SIZE > chat.messageCount){
			chat.messages = chat.messages.slice(0, chat.messageCount - page*PAGE_SIZE);
		}

		return fetchUserList(chat.messages.map(function(el){ return el.sender; }), "_id");
	});

	Promise.all([userChatPrm, userListPrm])
		.then(function(data){
		var user = data[0][0];
		var chat = data[0][1];
		var userList = data[1];

		for(var i = 0; i < chat.messages.length; i++){
			chat.messages[i].sender = {
				_id: userList[i]._id,
				email: userList[i].email,
				screenName: userList[i].screenName,
				color: userList[i].color
			};
		}

		res.status(200).send({title: chat.title, messages: chat.messages});

		var updateObject = {};
		updateObject["lastRead." + user._id] = chat.messageCount - page*PAGE_SIZE;

		db.update("chats", {
			_id: ObjectId(params.chatId),
			users: {$in: [user._id]}
		}, {
			$max: updateObject
		});
	})
		.catch(function(err){
		logger.error(err.stack);
		res.status(500);
		res.json({
			error: RESPONSE_MESSAGES.SERVER_ERROR
		})
	});
});

app.get("/mods/utils/:file", function(req, res){
	res.sendFile("/utils/" + req.params.file + ".js", {root: path.join(__dirname, "../mods")});
});

app.get("/mods/:dev/:name/*", function(req, res){
	var file = req.params[0];

	var modPrm = db.query("mods", {
		developer: req.params.dev,
		name: req.params.name
	});

	var nextPrm = modPrm.then(function(data){
		if(data.length != 1){
			res.status(404).send();
			return;
		}
		if(file == "worker"){
			res.sendFile(path.join(req.params.dev, req.params.name, data[0].worker), {root: path.join(__dirname, "../mods")});
			return;
		}
		if(file == "inline"){
			if(data[0].inline){
				return readFile(path.join(__dirname, "../mods", req.params.dev, req.params.name, data[0].inline.path, data[0].inline.main), "utf8");
			} else {
				res.status(404).send();
				return;
			}
		}
		var match = /ui(\/(.*))?/.exec(file);
		if(match !== null){
			var endpoint = match[1] || data[0].ui.main;
			res.sendFile(path.join(__dirname, "../mods", req.params.dev, req.params.name, data[0].ui.path, endpoint));
			return;
		}
		res.sendFile(path.join(req.params.dev, req.params.name, file), {root: path.join(__dirname, "../mods")});
		return;
	})
	.catch(function(err){
		logger.error(err.stack);
		res.status(500);
		res.json({
			error: RESPONSE_MESSAGES.SERVER_ERROR
		})
	});

	if(file == "inline"){
		Promise.all([modPrm, nextPrm])
			.then(function(data){
			var mod = data[0][0];
			var scss = data[1];

			scss = "[decoder='" + req.params.dev + "/" + req.params.name + "'] {" + scss + "}";
			var render = Promise.denodeify(sass.render);
			return render({
				data: scss,
				includePaths: [path.join(__dirname, "../mods", req.params.dev, req.params.name, mod.inline.path)]
			});
		})
			.then(function(result){
			res.setHeader("Content-Type", "text/css");
			res.status(200).send(result.css);
		})
			.catch(function(err){
			logger.error(err.stack);
			res.status(500);
			res.json({
				error: RESPONSE_MESSAGES.SERVER_ERROR
			})
		});
	}
});

app.post("/mods/new", function(req, res){ // TODO: any type of security, input validation
	var chk = argCheck(req.body, {type: "string", developer: "string", name: "string", content: "string"});
	if(!(chk.valid && /^[A-Za-z\-0-9]*$/.test(req.body.developer) && /^[A-Za-z\-0-9]*$/.test(req.body.name) && (req.body.type == "enc" || req.body.type == "dec"))){
		res.status(400);
		res.json({
			error: chk.error
		})
		return;
	}
	db.query("mods", {
		type: req.body.type,
		developer: req.body.developer,
		name: req.body.name
	})
		.then(function(data){
		if(data.length > 0){
			res.status(400);
			res.json({
				error: RESPONSE_MESSAGES.INVALID_MOD_ID
			})
			return;
		}

		return mkdirp(path.join(__dirname, "../mods") + "/" + req.body.type + "/" + req.body.developer);
	})
		.then(function(){
		writeFile(path.join(__dirname, "../mods") + "/" + req.body.type + "/" + req.body.developer + "/" + req.body.name + ".js", req.body.content);
	})
		.then(function(){
		res.status(200);
		res.json({
			result: "ok"
		})
	})
		.catch(function(err){
		logger.error(err.stack);
		res.status(500);
		res.json({
			error: RESPONSE_MESSAGES.SERVER_ERROR
		})
	});
});

/**
 * Serves all other files.
 */
app.use(express.static("public"));

http.listen(PORT, function(){
	logger.info("Listening on *:" + PORT);
});


/**
 * Hashes a given password with a given salt by performing HASH_COUNT iterations of {@code pw = sha512(pw + salt)}.
 * @param {string} password The password to hash
 * @param {string} salt The salt for the hash
 * @returns {string} The hashed password
 */
var passwordHash = function(password, salt){
	for(var i = 0; i < HASH_COUNT; i++){
		var hash = crypto.createHash("sha512"); // TODO: This might not work because the salt is greater length than the password/resulting hash.
		password = hash.update(password).update(salt).digest("base64");
	}
	return password;
}


/**
 * Returns a list of user objects from a list of users given by some unique field (usually emails or IDs).
 * @param {array} data The list of user parameters
 * @param {string} field The field for each user specified in {@code data}
 * @returns {Promise}
 */
var fetchUserList = function(data, field){
	var loading = [];

	for(var i = 0; i < data.length; i++){
		var obj = {};
		obj[field] = data[i];
		loading.push(db.query("users", obj));
	}

	return Promise.all(loading)
		.then(function(data){
		return data.map(function(d){ return d[0]; });
	});
}

io.on("connection", function(socket){
	/**
     * Authorizes a client socket and stores it for future use.
     */
	socket.on("login", function(user, auth){
		if(socket.userId){
			io.to(socket.id).emit("login error", {description: RESPONSE_MESSAGES.ALREADY_LOGGED_IN});
			return;
		}

		db.query("users", {
			email: user,
			authTokens: {
				$in: [auth] 
			}
		})
			.then(function(data){
			if(data.length != 1){
				io.to(socket.id).emit("login", RESPONSE_MESSAGES.INVALID_CREDENTIALS);
				return;
			}
			io.to(socket.id).emit("login", null, {_id: data[0]._id, contacts: data[0].contacts, email: data[0].email, screenName: data[0].screenName, color: data[0].color});
			socket.userId = data[0]._id;
			socket.email = data[0].email;
			if(!(socket.userId in SOCKETS)){
				SOCKETS[socket.userId] = [];
			}
			SOCKETS[socket.userId].push(socket);

			return db.query("chats", {});
		})
			.then(function(data){
			for(var i = 0; i < data.length; i++){
				socket.join(data[i]._id);
			}
		})
			.catch(function(err){
			logger.error(err.stack);
			io.to(socket.id).emit("login", RESPONSE_MESSAGES.SERVER_ERROR);
		});
	});

	/**
     * Disconnects a socket
     */
	socket.on("disconnect", function(){
		if(socket.userId === undefined){
			return;
		}

		var arr = SOCKETS[socket.userId];

		for(var i = 0; i < arr.length; i++){
			if(arr[i] == socket){
				arr.splice(i, 1);
				return;
			}
		}
	});

	/**
     * Emits a message sent by a user.
     */
	socket.on("message", function(chatId, msg){
		if(socket.userId === undefined){
			io.to(socket.id).emit("error", {description: RESPONSE_MESSAGES.NOT_AUTHORIZED});
		}
		var chatPrm = db.query("chats", {
			_id: ObjectId(chatId),
			users: {
				$in: [ObjectId(socket.userId)]
			}
		});

		var userPrm = db.query("users", {
			email: socket.email
		});

		Promise.all([chatPrm, userPrm])
			.then(function(data){
			var chat = data[0][0];
			var user = data[1][0];

			var packet = {
				chat: chat,
				msg: msg,
				socket: socket,
			}
			sendNotifs(packet)
			var sender = {
				email: socket.email,
				_id: socket.userId,
				screenName: user.screenName,
				color: user.color
			}; 

			io.to(chatId).emit("message", chatId, {
				sender: sender,
				message: msg,
				timestamp: moment().unix()
			});

			if(!msg[0].stream){
				return db.update("chats", {
					_id: ObjectId(chatId)
				}, {
					$push: {
						messages: {
							sender: socket.userId,
							message: msg,
							timestamp: moment().unix()
						}
					},
					$inc: {messageCount: 1}
				});
			}
		})
			.catch(function(err){
			logger.log(err.stack);
			io.to(socket.id).emit("error", {description: RESPONSE_MESSAGES.SERVER_ERROR});
		});
	});

	/**
     * Marks a user as "up to date" in a given chat.
     */
	socket.on("up to date", function(chatId){
		db.query("chats", {
			_id: ObjectId(chatId),
			users: {$in: [ObjectId(socket.userId)]}
		})
			.then(function(data){
			var setObj = {};
			setObj["lastRead." + socket.userId] = data[0].messageCount;
			return db.update("chats", {
				_id: ObjectId(chatId),
				users: {$in: [ObjectId(socket.userId)]}
			}, {
				$set: setObj
			});
		});
	});

	/**
     * Marks a user as having starred or unstarred a given chat.
     */
	socket.on("set star", function(chatId, starred){
		if(starred){
			db.update("chats", {
				_id: ObjectId(chatId),
				users: {$in: [ObjectId(socket.userId)]}
			}, {
				$addToSet: {starred: ObjectId(socket.userId)}
			});
		} else {
			db.update("chats", {
				_id: ObjectId(chatId),
				users: {$in: [ObjectId(socket.userId)]}
			}, {
				$pull: {starred: ObjectId(socket.userId)}
			});
		}
	});

	/**
	 * Lets the server know the client's hidden state
	 */

	socket.on("hidden", function(hidden) {
		socket.hidden = hidden
	})
});

//Determines to whom notifications ought to be sent
var sendNotifs = function(data) {
	var title = data.chat.title
	var body = data.socket.email + ": " + data.msg
	var p = data;
	var chat = data.chat;

	db.query("users", {
		_id: {$in: data.chat.users}
	})
		.then(function(data){
		var socketList = getRoom(chat._id);
		for(var i = 0; i < data.length; i++){
			//First case - do not send notification to sender
			if(data[i].email == p.socket.email){
				logger.log("Not sending to owner");
				continue;
			}
			//Second case - if they have no open browsers, send them a notification
			if(!(data[i].email in socketList)){
				castNotif(data[i].email, title, body);	
				logger.log("Attempting to send to closed client");
				continue;
			}
			//Third case - if all their clients are hidden, send them a notification
			var sockets = socketList[data[i].email];
			var shouldContinue = true;
			for(var s in sockets){
				if(!sockets[s].hidden){  //this will also catch the case where no hidden event was emitted, and thus the client is still open
					shouldContinue = false;
					break;
				}
			}
			if(shouldContinue){
				castNotif(data[i].email, title, body);
				logger.log("Attempting to send to hidden client");
				continue;
			}
			//Default case - the clients are opened and being viewed, so no notification is necessary
			logger.log("Client open, not sending");
		}
	})
}

//Super short helper method for sending a notif to a user
var castNotif = function(email, title, body) {
	push.sendMessage(email, {
		title: title,
		body: body,
		icon: "https://a-la-mod.com/images/app-icon-72.png",
	}, function(err) {
		logger.error("Error in sending notif: "+err)
	})
}

//gets all of the sockets in a room, organized by email
//TODO: we really need to spend like a couple days looking at how we can cache a lot of this stuff. 
//Not like its that hard to calculate, but we don't want to have to run this every time someone sends a message
var getRoom = function(room) {
	var ret = {};
	for(var sId in io.nsps["/"].adapter.rooms[room]){
		var sock = io.sockets.connected[sId]
		if(!ret[sock.email]){
			ret[sock.email] = [];
		}
		ret[sock.email].push(sock);
	}
	return ret;
}

/**
 * Ensures that the given argument object matches the given schema.
 * @param {object} args The provided argument object
 * @param {object} type The schema to check against
 * @returns {object} An object describing whether or not the provided object is valid and what errors exist, if any
 */
var argCheck = function(args, type){
	for(var kA in args){
		if(!type[kA]){
			return {valid: false, error: "Your request has an extra field \"" + kA + "\" and can't be processed."};
		}
		if(typeof type[kA] == "object"){
			if(typeof args[kA] != type[kA].type){
				return {valid: false, error: "Your request's \"" + kA + "\" field is of the wrong type and can't be processed."};
			}
		} else {
			if(typeof args[kA] != type[kA]){
				return {valid: false, error: "Your request's \"" + kA + "\" field is of the wrong type and can't be processed."};
			}
		}
	}
	for(var kT in type){
		if(!(kT in args) && !(typeof type[kT] == "object" && type[kT].optional)){
			return {valid: false, error: "Your request is missing the field \"" + kT + "\" and can't be processed."};
		}
	}
	return {valid: true};
}

var renderTemplate = function(text){
	if(!stub){
		return text;
	}
	return stub.replace(/{{content}}/g, text);
}

var sendVerEmail = function(verID, emailaddr, username){
	if(!sendgrid){
		logger.error("Can't send verification email");
		return;
	}
	email.sendEmail(sendgrid, emailaddr, {
		html: email.createEmail(emailaddr.split("@")[0], "Welcome to &Agrave; la Mod!<br>Before you can start using A la Mod, we ask that you verify your email. Click <a style='color: #ccc' href='https://a-la-mod.com/user/verify/"+verID+"'>here</a> to verify."),
		subject: "Verify Your Email"
	})
}

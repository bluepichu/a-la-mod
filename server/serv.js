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
var push = new pushObj(db.db);
var ObjectId = db.ObjectId;
var moment = require("moment");
var emailValidator = require("email-validator");
var cryptoString = require("random-crypto-string");
var mkdirp = require("mkdirp");
var sass = require("node-sass");

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

var sendgridlogin = require("sendgrid");
var sendgrid = undefined;

var local = false;

var email = require("./email");

var stub;
fs.readFile(__dirname + "/templates/notif-stubs.template", function(err, buff) {
	if(err){
		console.log(err);
	} else {
		stub = buff.toString();
	}
})

if(nconf.get("SGPASS")){
	sendgrid = sendgridlogin("a-la-mod", nconf.get("SGPASS"));

} else {
	console.log("Missing SGPASS environment variable. Will not be able to verify email addresses");
}
app.get("/push/:email/:title/:body", function(req, res) {
	push.sendMessage(req.params.email, {title: req.params.title, body: req.params.body}, function() {console.log(arguments)})
	res.send("Tried");
})
app.get("/push/get/:subId", function(req, res) {
	push.getMessage(req.params.subId, function(err, response) {
		console.log(arguments)
		res.type("application/json")
		res.send(JSON.stringify(response))
	})
})
/**
 * Serves the À la Mod page.
 */
app.get("/", function(req, res){
	res.sendFile("/index.html", {root: path.join(__dirname, "../public")});
});

/**
 * Serves the requested CSS file.
 */
app.get("/css/:file", function(req, res){
	res.sendFile("/css/" + req.params.file, {root: path.join(__dirname, "../public")});
});

/**
 * Serves the requested JS file.
 */
app.get("/js/*", function(req, res){
	res.sendFile("/js/" + req.params[0], {root: path.join(__dirname, "../public")});
});

app.get("/service-worker.js", function(req, res) {
	res.sendFile("/service-worker.js", {root: path.join(__dirname, "../public")})
})
/**
 * Serves the requested JS mod enconder file.
 */
app.get("/js/mods/enc/:file", function(req, res){
	res.sendFile("/js/mods/enc/" + req.params.file, {root: path.join(__dirname, "../public")});
});

/**
 * Serves the requested JS mod decoder file.
 */
app.get("/js/mods/dec/:file", function(req, res){
	res.sendFile("/js/mods/dec/" + req.params.file, {root: path.join(__dirname, "../public")});
});

/**
 * Serves the requested image file.
 */
app.get("/images/:file", function(req, res){
	res.sendFile("/images/" + req.params.file, {root: path.join(__dirname, "../public")});
});

/**
 * Serves the requested static file.
 */
app.get("/static/:file", function(req, res){
	res.sendFile("/static/" + req.params.file, {root: path.join(__dirname, "../public")});
});

/**
 * Returns the public data about a user.
 */
app.get("/user/:email", function(req, res){
	db.query("users", {email: req.params.email}, function(err, data){
		if(err){
			res.status(500);
			res.send("Request failed: server error.");
			return;
		}
		if(data.length != 1){
			res.status(400);
			res.send("Request failed: user not found.");
			return;
		}
		res.send(JSON.stringify({
			email: data[0].email,
			_id: data[0]._id,
			screenName: data[0].screenName
		}));
	});
});

app.get("/user/verify/:verID", function(req, res) {
	db.query("users", {verificationID: req.params.verID}, function(err, data) {
		if (err) {
			res.status(500);
			res.send("Request failed: server error.");
			return;
		}
		if (data.length != 1) {
			res.status(400);
			res.send(renderTemplate("No user with this verification ID found")); //TODO: make prettier
			return;
		}
		if (data[0].verified) {
			res.status(200);
			res.send(renderTemplate("User already verified!"));
			return;
		}
		db.update("users", {verificationID: req.params.verID}, {"$set": {verified: true}}, function(err, data) {
			if (err) {
				res.status(500);
				res.send(renderTemplate("Unable to verify user"));
				return;
			}
			res.status(201);
			res.send(renderTemplate("User verified!"));
		})
	})
})


app.get("/user/reset/:resetID", function(req, res) {
	db.query("users",{resID: req.params.resetID}, function(err, data) {
		if (err) {
			res.status(500);
			res.send("Request failed: Server error.");
			return;
		}
		if (data.length != 1) {
			res.status(400);
			res.send(renderTemplate("No user with this reset ID found"));
			return;
		}
		cryptoString(12, function(err, password){
			var hash = passwordHash(password, data[0].salt);
			db.update("users", {email: data[0].email}, {$set: {password: hash}}, function(err, datam){
				if (err) {
					res.status(400);
					res.send(renderTemplate("An error has occurred"));
					return;
				}
				res.status(200);
				res.send(renderTemplate("Your password has been reset to: "+password+". Please remember to change your password the next time you log in."));
				if (!sendgrid) {
					console.log("Error, cannot send reset email");
				}
				email.sendEmail(
					sendgrid,
					data[0].email,
					{
						html: email.createEmail(data[0].email.split("@")[0], "Your password has been reset to: "+password+". Please remember to change your password the next time you log in."),
						subject: "Your A la Mod password has been reset"
					}
				)
				db.update("users",{resID: req.params.resetID}, {$unset:{resID: ""}}, function(){});
			});
		});
	})

})
app.post("/user/notifs/register", function(req, res) {
	var chk = argCheck(req.body, {email: "string", auth: "string", subscriptionId: "string", shouldAdd: "boolean"})
	if (!chk.valid) {
		res.status(400);
		res.send("Request failed: "+JSON.stringify(chk))
		return;
	}
	db.query("users", {
		email: req.body.email, 
		authTokens: {
			$in: [req.body.auth]
		}}, function(err, data) {
		if (err) {
			res.status(500);
			res.send("Request failed: Server error.")
			return;
		}
		if (data.length != 1) {
			res.status(400);
			res.send("Request failed: Unauthorized user");
			return;
		}
		if (!data[0].verified) {
			res.status(400);
			res.send("Request failed: User not verified");
			return;
		}
		if (req.body.shouldAdd) {
			push.addKey(req.body.email, req.body.subscriptionId)
		} else {
			push.removeKey(req.body.email, req.body.subscriptionId)
		}
	})
})
/**
 * Creates a new user.  Parameters are provided in the POST request as a JSON object.
 */
app.post("/user/new", function(req, res){
	var chk = argCheck(req.body, {email: "string", password: "string"});
	if (!chk.valid) {
		res.status(400);
		res.send("Request failed: "+JSON.stringify(chk));
		return;
	}

	if(!emailValidator.validate(req.body.email)){
		res.status(400);
		res.send("Request failed: 'email' value does not follow the proper format.");
		return;
	}

	db.query("users", {email: req.body.email}, function(err, data){
		if(err || data.length > 0){
			res.status(400);
			res.send("Request failed: this email is associated with another account.");
			return;
		}

		var salt = crypto.randomBytes(32).toString("base64");
		var password = passwordHash(req.body.password, salt);

		var verID = crypto.randomBytes(16).toString("hex");
		var email = req.body.email;
		var user = req.body.email;
		db.insert("users", {
			email: req.body.email,
			password: password,
			salt: salt,
			authTokens: [],
			screenName: req.body.email,
			verificationID: verID,
			verified: false || local,
			contacts: [req.body.email]
		}, function(err, data){
			if(err){
				res.status(500);
				res.send("Request failed: server error.");
			} else {
				res.status(200);
				res.send("Ok.");
				if (!local) {
					sendVerEmail(verID, email, user); //change the third param to username when we get one
				}
			}
		});
	});
});

/**
 * Authorizes a user and provides them with an auth token.  Parameters are provided in the POST request as a JSON object.
 */
app.post("/user/auth", function(req, res){
	var chk = argCheck(req.body, {email: "string", password: "string"});
	if (!chk.valid) {
		res.status(400);
		res.send("Request failed: "+JSON.stringify(chk));
		return;
	}
	db.query("users", {
		email: req.body.email
	},
			 function(err, data){
		if(err){
			res.status(500);
			res.send("Requst failed: server error.");
			return;
		}
		if(data.length != 1){
			res.status(400);
			res.send("Request failed: user not found.");
			return;
		}
		if(passwordHash(req.body.password, data[0].salt) != data[0].password){
			res.status(400);
			res.send("Request failed: incorrect password.");
			return;
		}

		// issue auth token
		var token = crypto.randomBytes(256).toString("base64");
		res.status(200);
		res.send(token);

		db.update("users", {
			email: data[0].email
		},
				  {
			$push: {authTokens: token}
		},
				  function(err, data){});
	});
});

/**
 * Creates a new chat.  Parameters are provided in the POST request as a JSON object.
 */
app.post("/chat/new", function(req, res){ // TODO: This should require auth
	if(!argCheck(req.body,{email: "string", authToken: "string", title: "string", users: "object"}).valid) {
		res.status(400);
		res.send("Request failed: missing users list.");
		return;
	}
	db.query("users", {
		email: req.body.email, 
		authTokens: {
			$in: [req.body.authToken]
		}}, function(err, data) {
		if (err) {
			res.status(500);
			res.send("Request failed: Server error.")
			return;
		}
		if (data.length != 1) {
			res.status(400);
			res.send("Request failed: Unauthorized user");
			return;
		}
		if (!data[0].verified) {
			res.status(400);
			res.send("Request failed: User not verified");
			return;
		}
		fetchUserList(req.body.users, "email", function(users){
			var lastRead = {};

			for(var i = 0; i < users.length; i++){
				lastRead[users[i]._id] = 0;
			}

			db.insert("chats", {
				users: users.map(function(el){ return el._id }),
				title: req.body.title,
				messages: [],
				lastRead: lastRead,
				messageCount: 0,
				creationTime: moment().unix()
			},
					  function(err, data){
				if(err){
					res.status(500);
					res.send("Request failed: server error.");
					return;
				}

				for(var i = 0; i < users.length; i++){
					db.update("users", {_id: ObjectId(users[i]._id)}, {$addToSet: {contacts: {$each: req.body.users}}}, function(){});
					if(users[i]._id in SOCKETS){
						for(var j = 0; j < SOCKETS[users[i]._id].length; j++){
							SOCKETS[users[i]._id][j].join(data._id);
						}
					}
				}

				io.to(data._id).emit("new chat", {
					_id: data._id,
					title: data.title,
					users: users.map(function(el){return {_id: el._id, email: el.email, screenName: el.screenName}; })
				});

				res.status(200);
				res.send("Ok.");
			})});
	})
});

/**
 * Updates a user's information.  Parameters are provided in the POST request as a JSON object.
 */
app.post("/user/update", function(req, res){
	var chk = argCheck(req.body, {email: "string", password: "string", updates: "object"});
	if(!chk.valid) {
		res.status(400);
		res.send("Request failed: "+JSON.stringify(chk));
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
	db.query("users", {email: req.body.email}, function(err, data){
		if(err){
			res.status(500);
			res.send("Request failed: server error.");
			return;
		}
		if(data.length != 1){
			res.status(400);
			res.send("Request failed: user not found.");
			return;
		}
		db.update("users", {
			email: req.body.email,
			password: passwordHash(req.body.password, data[0].salt)
		}, {
			$set: updateObj
		}, function(er, dat){
			if(er){
				res.status(500);
				res.send("Request failed: server error.");
				return;
			}
			if(dat.n == 0){
				res.status(400);
				res.send("Request failed: incorrect password.");
				return;
			}
			res.status(200);
			res.send("Ok.");
		});
	});
});

/**
 * Sends a password recovery email to the specified address.
 */
app.post("/user/reset-password", function(req, res){
	var chk = argCheck(req.body, {email: "string"});
	if(!chk.valid) {
		res.status(400);
		res.send("Request failed: " + JSON.stringify(chk));
		return;
	}
	db.query("users", {email: req.body.email}, function(err, data){
		if(err){
			res.status(500);
			res.send("Request failed: server error.");
			return;
		}

		if(!data || data.length != 1){
			res.status(400);
			res.send("Request failed: no user exists with that email.");
			return;
		}

		var resID = crypto.randomBytes(16).toString("hex");
		db.update("users", {email: req.body.email}, {$set: {resID: resID}}, function(err, data) {
			if (err) {
				res.status(400);
				res.send("Request failed: Unknown error");
				return;
			}
			res.status(200);
			res.send("An email has been sent to "+req.body.email);
			if (!sendgrid) {
				console.log("Error, cannot send reset email");
				return
			}
			email.sendEmail(
				sendgrid,
				req.body.email,
				{
					html: email.createEmail(req.body.email.split("@")[0], "You recently requested to change your password. If you still wish to do so, please click <a href='http://a-la-mod.herokuapp.com/user/reset/"+resID+"'>here</a>. If you did not request this, you may safely ignore this message."),
					subject: "A la Mod password reset"
				}
			)

		})
	});
});

/**
 * Returns a list of chats for the current user.  Parameters are provided in the POST request as a JSON object.
 */
app.post("/chats", function(req, res){
	var chk = argCheck(req.body, {email: "string", authToken: "string" });
	if (!chk.valid) {
		res.status(400);
		res.send("Request failed: "+JSON.stringify(chk));
		return;
	}

	db.query("users", {
		email: req.body.email,
		authTokens: {$in: [req.body.authToken]}
	}, function(err, data){
		if(err){
			res.status(500);
			res.send("Request failed: server error.");
			return;
		}
		if(data.length != 1){
			res.status(400);
			res.send("Request failed: user not found or password incorrect.");
			return;
		}
		db.project("chats", {
			users: {$in: [data[0]._id]}
		}, {
			_id: 1,
			messages: {$slice: [-1, 1]},
			users: 1,
			lastRead: 1,
			messageCount: 1,
			creationTime: 1,
			title: 1
		},
				   function(er, dat){
			if(er){
				res.status(500);
				res.send("Request failed: server error.");
				return;
			}

			var ash = new AsyncHandler(function(){
				res.status(200).send(dat);
			});

			for(var i = 0; i < dat.length; i++){
				ash.attach(fetchUserList, [dat[i].users.map(function(el){ return ObjectId(el); }), "_id"], function(ind){return function(userList){
					dat[ind].users = userList.map(function(el){return {_id: el._id, email: el.email, screenName: el.screenName}; });
					if(dat[ind].messages.length > 0){
						for(var i = 0; i < userList.length; i++){
							if(userList[i]._id.toString() == dat[ind].messages[0].sender.toString()){
								dat[ind].messages[0].sender = userList[i].screenName;
								break;
							}
						}
					}
					this.next();
				}}(i));
			}

			ash.run();       
		});
	});
});

/**
 * Returns a list of previous messages for a given chat.  Parameters are provided in the POST request as a JSON object.
 */
app.post("/chat/history", function(req, res){
	var chk = argCheck(req.body, {chatId: "string", email: "string", authToken: "string", page: {type: "number", optional: true}});
	if (!chk.valid) {
		res.status(400);
		res.send("Request failed: "+JSON.stringify(chk));
		return;
	}

	var page = 0;
	if(req.body.page){
		page = req.body.page;
	}

	db.query("users", {
		email: req.body.email,
		authTokens: {$in: [req.body.authToken]}
	}, function(err, data){
		if(err){
			res.status(500);
			res.send("Request failed: server error.");
			return;
		}
		if(data.length != 1){
			res.status(400);
			res.send("Request failed: user not found or password incorrect.");
			return;
		}
		db.project("chats", {
			_id: ObjectId(req.body.chatId),
			users: {$in: [ObjectId(data[0]._id)]}
		}, {
			messages: {$slice: [-(page+1)*PAGE_SIZE, PAGE_SIZE]},
			messageCount: 1
		},
				   function(er, dat){
			if(er){
				res.status(500);
				res.send("Request failed: server error.");
				return;
			}
			if(dat.length != 1){
				res.status(400);
				res.send("Request failed: chat not found.");
				return;
			}

			if(page*PAGE_SIZE > dat[0].messageCount){
				res.status(200).send({title: dat[0].title, messages: []});
				return;
			} else if((page+1)*PAGE_SIZE > dat[0].messageCount){
				dat[0].messages = dat[0].messages.slice(0, dat[0].messageCount - page*PAGE_SIZE);
			}

			data = data[0];
			dat = dat[0];

			var ash = new AsyncHandler(function(){
				res.status(200).send({title: dat.title, messages: dat.messages});
			});

			for(var i = 0; i < dat.messages.length; i++){
				ash.attach(db.query, ["users", {_id: ObjectId(dat.messages[i].sender)}], function(ind){ return function(e, da){
					da = da[0];
					dat.messages[ind].sender = {
						_id: da._id,
						email: da.email,
						screenName: da.screenName,
						color: da.color
					};
					this.next();
				};}(i));
			}

			ash.run();

			var updateObject = {};
			updateObject["lastRead." + data._id] = dat.messageCount - page*PAGE_SIZE;

			db.update("chats", {
				_id: ObjectId(req.body.chatId),
				users: {$in: [data._id]}
			}, {
				$max: updateObject
			}, function(){});
		});
	});
});

app.get("/mods/utils/:file", function(req, res){
	res.sendFile("/utils/" + req.params.file + ".js", {root: path.join(__dirname, "../mods")});
});

app.get("/mods/:type/:dev/:name/*", function(req, res){
	db.query("mods", {
		type: req.params.type,
		developer: req.params.dev,
		name: req.params.name
	}, function(err, data){
		if(err || !data){
			res.status(500).send();
			return;
		}
		if(data.length != 1){
			res.status(404).send();
			return;
		}
		var file = req.params[0];
		if(file == "worker"){
			res.sendFile(path.join(req.params.type, req.params.dev, req.params.name, data[0].worker), {root: path.join(__dirname, "../mods")});
			return;
		}
		if(file == "styles"){
			if(data[0].styles){
				fs.readFile(path.join(__dirname, "../mods", req.params.type, req.params.dev, req.params.name, data[0].styles), "utf8", function(er, dat){
					if(er || !dat){
						res.status(500).send();
						return;
					}
					dat = "[decoder='" + req.params.dev + "/" + req.params.name + "'] {" + dat + "}";
					sass.render({
						data: dat,
						includePaths: [path.join(__dirname, "../mods", req.params.type, req.params.dev, req.params.name)]
					}, function(err, result){
						res.setHeader("Content-Type", "text/css");
						res.status(200).send(result.css);
					});
				});
				return;
			} else {
				res.status(404).send();
				return;
			}
		}
		res.sendFile(path.join(req.params.type, req.params.dev, req.params.name, file), {root: path.join(__dirname, "../mods")});
		return;
	});
});

app.post("/mods/new", function(req, res){ // TODO: any type of security, input validation
	if(!(argCheck(req.body, {type: "string", developer: "string", name: "string", content: "string"}).valid && /^[A-Za-z\-0-9]*$/.test(req.body.developer) && /^[A-Za-z\-0-9]*$/.test(req.body.name) && (req.body.type == "enc" || req.body.type == "dec"))){
		res.status(400).send();
		return;
	}
	db.query("mods", {
		type: req.body.type,
		developer: req.body.developer,
		name: req.body.name
	}, function(err, data){
		if(err || !data){
			res.status(500).send();
			return;
		}

		if(data.length > 0){
			res.status(400).send();
			return;
		}

		mkdirp(path.join(__dirname, "../mods") + "/" + req.body.type + "/" + req.body.developer, function(er){
			if(er){
				res.status(500).send(er);
				return;
			}
			fs.writeFile(path.join(__dirname, "../mods") + "/" + req.body.type + "/" + req.body.developer + "/" + req.body.name + ".js", req.body.content, function(e){
				if(e){
					res.status(500).send(e);
					return;
				}
				res.status(200).send();
			});
		});
	});
});

/**
 * Serves all other files.
 */
app.use(express.static("public"));

http.listen(PORT, function(){
	console.log("listening on *:" + PORT);
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
 * @param {string} field The field for each user specified in {@code data }
 * @param {function} cb Callback function taking a single parameter, the resulting user list
 */
var fetchUserList = function(data, field, cb){
	var resultList = [];
	var ash = new AsyncHandler(function(ret){return function(){cb(ret)}}(resultList));

	for(var i = 0; i < data.length; i++){
		var obj = {};
		obj[field] = data[i];
		ash.attach(db.query, ["users", obj], function(err, dat){
			if(!err){
				if(dat[0]){
					resultList.push(dat[0]);
				}
			}
			this.next();
		});
	}

	ash.run();
}

io.on("connection", function(socket){
	/**
     * Authorizes a client socket and stores it for future use.
     */
	socket.on("login", function(user, auth){
		if(socket.userId){
			io.to(socket.id).emit("login error", {description: "Login failed: you're alerady logged in!"});
			return;
		}
		db.query("users", {
			email: user,
			authTokens: {
				$in: [auth] 
			}
		},
				 function(err, data){
			if(err){
				io.to(socket.id).emit("login", "Login failed: server error.");
				return;
			}
			if(data.length != 1){
				io.to(socket.id).emit("login", "Login failed: authorization error.");
				return;
			}
			io.to(socket.id).emit("login", null, {_id: data[0]._id, contacts: data[0].contacts, email: data[0].email, screenName: data[0].screenName, color: data[0].color});
			socket.userId = data[0]._id;
			socket.email = data[0].email;
			if(!(socket.userId in SOCKETS)){
				SOCKETS[socket.userId] = [];
			}
			SOCKETS[socket.userId].push(socket);

			db.query("chats", {

			}, function(er, dat){
				if(!er){
					for(var i = 0; i < dat.length; i++){
						socket.join(dat[i]._id);
					}
				}
			});
		});
	});

	/**
     * Disconnects a socket
     */
	socket.on("disconnect", function(){
		if(socket.userId === undefined){
			return;
		}

		arr = SOCKETS[socket.userId];

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
			io.to(socket.id).emit("error", {description: "Request failed: you're not logged in."});
		}
		db.query("chats", {
			_id: ObjectId(chatId),
			users: {
				$in: [ObjectId(socket.userId)]
			}
		},
				 function(err, data){
			if(err || data.length == 0){
				io.to(socket.id).emit("error", {description: "Request failed: you're not a part of that chat."});
				return;
			}
			db.query("users", {
				email: socket.email
			},
					 function(er, dat){
				if(er || !dat){
					// ???
					io.to(socket.id).emit("error", {description: "Request failed: server error."});
					return;
				}
				var packet = {
					chat: data[0],
					msg: msg,
					socket: socket,
				}
				sendNotifs(packet)
				var sender = {
					email: socket.email,
					_id: socket.userId,
					screenName: dat[0].screenName,
					color: dat[0].color
				}; 

				io.to(chatId).emit("message", chatId, {
					sender: sender,
					message: msg,
					timestamp: moment().unix()
				});

				db.update("chats", {
					_id: ObjectId(chatId)
				},
						  {
					$push: {
						messages: {
							sender: socket.userId,
							message: msg,
							timestamp: moment().unix()
						}
					},
					$inc: {messageCount: 1}
				},
						  function(err, data){});
			});
		});
	});

	/**
     * Marks a user as "up to date" in a given chat.
     */
	socket.on("up to date", function(chatId){
		db.query("chats", {
			_id: ObjectId(chatId),
			users: {$in: [ObjectId(socket.userId)]}
		}, function(err, data){
			if(err){
				return;
			}
			var setObj = {};
			setObj["lastRead." + socket.userId] = data[0].messageCount;
			db.update("chats", {
				_id: ObjectId(chatId)
			}, {
				$set: setObj
			}, function(){});
		});
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
	}, function(err, data) {
		if (err) {
			console.log(err)
			return;
		}
		var socketList = getRoom(chat._id)
		for (var i in data) {
			console.log(">> "+Object.keys(socketList))
			//First case - do not send notification to sender
			if (data[i].email == p.socket.email) {
				console.log("Not sending to owner")
				continue;
			}
			//Second case - if they have no open browsers, send them a notification
			if (!(data[i].email in socketList)) {
				castNotif(data[i].email, title, body) 	
				console.log("Attempting to send to closed client")
				continue
			}
			//Third case - if all their clients are hidden, send them a notification
			var sockets = socketList[data[i].email]
			var shouldContinue = true;
			for (var s in sockets) {
				if (!sockets[s].hidden) {  //this will also catch the case where no hidden event was emitted, and thus the client is still open
					shouldContinue = false;
					break;
				}
			}
			if (shouldContinue) {
				castNotif(data[i].email, title, body)
				console.log("Attempting to send to hidden client")
				continue;
			}
			//Default case - the clients are opened and being viewed, so no notification is necessary
			console.log("Client open, not sending");
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
		console.log("Error in sending notif: "+err)
	})
}

//gets all of the sockets in a room, organized by email
//TODO: we really need to spend like a couple days looking at how we can cache a lot of this stuff. 
//Not like its that hard to calculate, but we don't want to have to run this every time someone sends a message
var getRoom = function(room) {
	var ret = {}
	for (var sId in io.nsps["/"].adapter.rooms[room]) {
		var sock = io.sockets.connected[sId]
		if (!ret[sock.email]) {
			ret[sock.email] = []
		}
		ret[sock.email].push(sock)
	}
	return ret

}

// AsyncHandler written by bluepichu.  May become an import at a later point, since this may be published as its own project.
var AsyncHandler = function(done){
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


/**
 * Ensures that the given argument object matches the given schema.
 * @param {object} args The provided argument object
 * @param {object} type The schema to check against
 * @returns {object} An object describing whether or not the provided object is valid and what errors exist, if any
 */
var argCheck = function(args, type){
	for(kA in args) {
		if(!type[kA]) {
			return {valid: false, extra: kA};
		}
		if(typeof type[kA] == "object"){
			if(typeof args[kA] != type[kA].type){
				return {valid: false, badType: kA};
			}
		} else {
			if(typeof args[kA] != type[kA]) {
				return {valid: false, badType: kA};
			}
		}
	}
	for(kT in type) {
		if(!(kT in args) && !(typeof type[kT] == "object" && type[kT].optional)) {
			return {valid: false, missing: kT};
		}
	}
	return {valid: true}
}

var renderTemplate = function(text) {
	if (!stub) {
		return text;
	}
	return stub.replace(/{{content}}/g,text)
}

var sendVerEmail = function(verID, emailaddr, username) {
	if (!sendgrid) {
		console.log("Error, cannot send verification email");
		return
	}
	email.sendEmail(
		sendgrid,
		emailaddr,
		{
			html: email.createEmail(emailaddr.split("@")[0], "Welcome to &Agrave; la Mod!<br>Before you can start using A la Mod, we ask that you verify your email. Click <a style='color: #ccc' href='https://a-la-mod.com/user/verify/"+verID+"'>here</a> to verify."),
			subject: "Verify Your Email"
		}
	)
}

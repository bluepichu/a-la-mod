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
var crypto = require("crypto");
var db = require("./db");
var ObjectId = db.ObjectId;
var moment = require("moment");

var connect_handlebars = require("connect-handlebars");
app.use("/templates/templates.js", connect_handlebars(__dirname + "/../public/templates", {
    exts: ["hbs"]
}));

var HASH_COUNT = 2;  // Number of times passwords are hashed.  DO NOT CHANGE, AS IT WILL BREAK OLD ACCOUNTS.
var PAGE_SIZE = 2e9;  // Number of chat results to return in a single request.

var PLAINTEXT_COMM = ObjectId("54cc2db98c8b2e4fc87cbcb1");

var SOCKETS = {}; // Stores currently authorized sockets, as {<user id>: [<list of connected sockets authorized with user id>]}

var PORT = process.env.PORT || 1337; // Sets the socket to whatever the evironment specifies, or 1337 if a port is not specified

/**
 * Serves either the chat page or the login page depending on whether or not the user is logged in.
 */
app.get("/", function(req, res){
    /*
    if(req.cookies.email && req.cookies.authToken){
        db.query("users", {
            email: req.cookies.email,
            authTokens: {$in: [req.cookies.authToken]}
        },
                 function(data, err){
            if(data.length == 1){
                res.sendFile("/chat.html", {root: path.join(__dirname, "../public")});
            } else {
                res.sendFile("/enter.html", {root: path.join(__dirname, "../public")});
            }
        });
    } else {
        res.sendFile("/enter.html", {root: path.join(__dirname, "../public")});
    }*/
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
app.get("/js/:file", function(req, res){
    res.sendFile("/js/" + req.params.file, {root: path.join(__dirname, "../public")});
});

/**
 * Serves the requested image file.
 */
app.get("/images/:file", function(req, res){
    res.sendFile("/images/" + req.params.file, {root: path.join(__dirname, "../public")});
});

/**
 * Creates a new user.  Parameters are provided in the POST request as a JSON object.
 */
app.post("/user/new", function(req, res){
    console.log(req.body);
    var chk = argCheck(req.body, {email: "string", password: "string"})
    console.log (chk);
    if (!chk.valid) {
        res.status(400);
        res.send("Request failed: "+JSON.stringify(chk));
        return;
    }
    
    if(! /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,7}$/.test(req.body.email)){ // TODO
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

        var salt = crypto.randomBytes(256).toString("base64");
        var password = passwordHash(req.body.password, salt);

        db.insert("users", {
            email: req.body.email,
            password: password,
            salt: salt,
            authTokens: [],
            screenName: req.body.email
        }, function(err, data){
            if(err){
                res.status(500);
                res.send("Request failed: server error.");
            } else {
                console.log("user inserted.");
                res.status(200);
                res.send("Ok.");
            }
        });
    });
});

/**
 * Authorizes a user and provides them with an auth token.  Parameters are provided in the POST request as a JSON object.
 */
app.post("/user/auth", function(req, res){
    var chk = argCheck(req.body, {email: "string", password: "string"})
    console.log (chk);
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
            res.send("Requst faild: server error.");
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
    if(!argCheck(req.body,{users:"object"}).valid) {
        res.status(400);
        res.send("Request failed: missing users list.");
        return;
    }

    fetchUserList(req.body.users, "email", function(users){
        var lastRead = {};

        for(var i = 0; i < users.length; i++){
            lastRead[users[i]._id] = 0;
        }

        db.insert("chats", {
            users: users.map(function(el){ return el._id }),
            comms: [PLAINTEXT_COMM],
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
                if(users[i]._id in SOCKETS){
                    for(var j = 0; j < SOCKETS[users[i]._id].length; j++){
                        SOCKETS[users[i]._id][j].join(data._id);
                    }
                }
            }

            io.to(data._id).emit("new chat", {
                _id: data._id,
                users: users.map(function(el){ return el.screenName; })
            });

            res.status(200);
            res.send("Ok.");
        })});
});

/**
 * Changes a user's screen name.  Parameters are provided in the POST request as a JSON object.
 */
app.post("/user/screen-name", function(req, res){
    var chk = argCheck(req.body, {email: "string", authToken: "string", screenName: "string"})
    console.log (chk);
    if (!chk.valid) {
        res.status(400);
        res.send("Request failed: "+JSON.stringify(chk));
        return;
    }
    db.update("users", {
        email: req.body.email,
        authTokens: {
            $in: [req.body.authToken]
        }
    },
              {
        $set: {
            screenName: req.body.screenName
        }
    },
              function(err, data){
        if(err){
            res.status(500);
            res.send("Request failed: server error.");
            return;
        }
        if(data.length == 0){
            res.status(400);
            res.send("Request failed: user not found or password incorrect.");
            return;
        }
        res.status(200);
        res.send("Ok.");
    });
});

/**
 * Returns a list of chats for the current user.  Parameters are provided in the POST request as a JSON object.
 */
app.post("/chats", function(req, res){
    var chk = argCheck(req.body, {email: "string", authToken: "string" })
    console.log (chk);
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
            creationTime: 1
        },
                   function(dat, er){
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
                    dat[ind].users = userList.map(function(el){return el.screenName;});
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
    var chk = argCheck(req.body, {chatId: "string", email: "string", authToken: "string" })
    console.log (chk);
    if (!chk.valid) {
        res.status(400);
        res.send("Request failed: "+JSON.stringify(chk));
        return;
    }
    /**
    if(!req.body.email){
        res.status(400);
        res.send("Request failed: missing 'email' field.");
        return;
    }
    if(!req.body.authToken){
        res.status(400);
        res.send("Request failed: missing 'authToken' field.");
        return;
    }
    if(!req.body.chatId){
        res.status(400);
        res.send("Request failed: missing 'chatId' field.");
        return;
    }
    **/
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
            messages: {$slice: [-(page+1)*PAGE_SIZE, PAGE_SIZE]}
        },
                   function(dat, er){
            if(er){
                res.status(500);
                res.send("Request failed: server error.");
                console.log(er);
                return;
            }
            if(dat.length != 1){
                res.status(400);
                res.send("Request failed: chat not found.");
                return;
            }
            res.status(200);
            res.send(dat[0].messages);

            var updateObject = {};
            updateObject["lastRead." + data[0]._id] = dat[0].messageCount - page*PAGE_SIZE;

            db.update("chats", {
                _id: ObjectId(req.body.chatId),
                users: {$in: [data[0]._id]}
            }, {
                $max: updateObject
            }, function(){});
        });
    });
});

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
        ash.attach(db.query, ["users", obj], function(dat, err){
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
     * Authorizes a client socket and stores it for future use
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
                io.to(socket.id).emit("login error", {description: "Login failed: server error."});
                return;
            }
            if(data.length != 1){
                io.to(socket.id).emit("login error", {description: "Login failed: invalid auth token."});
                return;
            }
            io.to(socket.id).emit("login success", {description: "Login succeeded.", id: data[0]._id});
            console.log("Login succeeded.");
            socket.userId = data[0]._id;
            socket.email = data[0].email;
            console.log(socket.userId);
            if(!(socket.userId in SOCKETS)){
                SOCKETS[socket.userId] = [];
            }
            SOCKETS[socket.userId].push(socket);

            db.query("chats", {

            },
                     function(dat, er){
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
     * Emits a request to add a comm to a given chat
     */
    socket.on("commrequest", function(chatId, comm){
        db.query("chats", {
            _id: Objectid(chatId),
            users: {$in: [ObjectId(socket.userId)]}
        }, function(err, data){
            if(err){
                io.to(socket.id).emit("error", {description: "Request failed: server error."});
                return;
            }
            if(data.length != 1){
                io.to(socket.id).emit("error", {description: "Request failed: can't find chat."});
                return;
            }
            var found = false;
            for(var i = 0; i < data[0].comms.length; i++){
                if(data[0].comms[i] == comm){
                    found = true;
                    break;
                }
            }
            if(found){
                io.to(socket.id).emit("error", {description: "Request failed: comm already in use."});
            } else {
                //stuff
            }
        });
    });

    /**
     * Emits a message sent by a user
     */
    socket.on("message", function(chatId, comm, msg){
        if(socket.userId === undefined){
            io.to(socket.id).emit("error", {description: "Request failed: you're not logged in."});
        }
        // do something fun with comms here later
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
            console.log("sending message...");
            db.query("users", {
                email: socket.email
            },
                     function(dat, er){
                if(er || !dat){
                    // ???
                    io.to(socket.id).emit("error", {description: "Request failed: server error."});
                    return;
                }

                io.to(chatId).emit("message", chatId, socket.userId, dat[0].screenName, msg); // comm will probably be a part of this later

                db.update("chats", {
                    _id: ObjectId(chatId)
                },
                          {
                    $push: {messages: {
                        sender: dat[0]._id,
                        comm: comm,
                        message: msg,
                        timestamp: moment().unix()
                    }},
                    $inc: {messageCount: 1}
                },
                          function(err, data){});
            });
        });
    });

    /**
     * Marks a user as "up to date" in a given chat
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
});

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
 * @returns {object} An object describing whether or not the provided object is valid and what errors exist if any
 */
var argCheck = function(args, type) {
	for (kA in args) {
		if (! type[kA]) {
			return {valid: false, extra: kA};
		}
		if (typeof args[kA] != type[kA]) {
			return {valid: false, badType: kA};
		}
	}
	for (kT in type) {
		if (! args[kT]) {
			return {valid: false, missing: kT};
		}
	}
	return {valid: true}
}

// DEBUG: prints out the SOCKETS object every 20 seconds
setInterval(function(){
    console.log();
    for(x in SOCKETS){
        console.log(x + ": " + SOCKETS[x].length);
    }
    console.log();
}, 20000);

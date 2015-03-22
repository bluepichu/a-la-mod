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

var HASH_COUNT = 1726;  // Number of times passwords are hashed.  DO NOT CHANGE, AS IT WILL BREAK OLD ACCOUNTS.
var PAGE_SIZE = 2e9;  // Number of chat results to return in a single request.

var PLAINTEXT_COMM = ObjectId("54cc2db98c8b2e4fc87cbcb1");

var SOCKETS = {}; // Stores currently authorized sockets, as {<user id>: [<list of connected sockets authorized with user id>]}

var PORT = process.env.PORT || 1337; // Sets the socket to whatever the evironment specifies, or 1337 if a port is not specified

/**
 * Serves either the chat page or the login page depending on whether or not the user is logged in.
 */
app.get("/", function(req, res){
    if(req.cookies.email && req.cookies.authToken){
        db.query("users", {
            email: req.cookies.email,
            authTokens: {$in: [req.cookies.authToken]}
        },
                 function(data, err){
            if(data.length == 1){
                res.sendFile("/chat.html", {root: path.join(__dirname, "../public")});
            } else {
                res.sendFile("/login.html", {root: path.join(__dirname, "../public")});
            }
        });
    } else {
        res.sendFile("/login.html", {root: path.join(__dirname, "../public")});
    }
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
    if(!req.body.email){
        res.status(400);
        res.send("Request failed: missing 'email' field.");
        return;
    }
    if(!req.body.password){
        res.status(400);
        res.send("Request failed: missing 'password' field.");
        return;
    }
    if(! /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,4}$/.test(req.body.email)){
        res.status(400);
        res.send("Request failed: 'email' value does not follow the proper format.");
        return;
    }

    db.query("users", {email: req.body.email}, function(data, err){
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
        }, function(data, err){
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
    console.log(JSON.stringify(req.body));
    if(!req.body.email){
        res.status(400);
        res.send("Request failed: missing 'email' field.");
        return;
    }
    if(!req.body.password){
        res.status(400);
        res.send("Request failed: missing 'password' field.");
        return;
    }
    db.query("users", {
        email: req.body.email
    },
             function(data, err){
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
                  function(data, err){});
    });
});

/**
 * Creates a new chat.  Parameters are provided in the POST request as a JSON object.
 */
app.post("/chat/new", function(req, res){ // TODO: This should require auth
    if(!req.body.users){
        res.status(400);
        res.send("Request failed: missing users list.");
        return;
    }

    fetchUserIds(req.body.users, function(ids){
        var lastRead = {};

        for(var i = 0; i < ids.length; i++){
            lastRead[ids[i]] = 0;
        }

        db.insert("chats", {
            users: ids,
            comms: [PLAINTEXT_COMM],
            messages: [],
            lastRead: lastRead,
            messageCount: 0,
            creationTime: moment().unix()
        },
                  function(data, err){
            if(err){
                res.status(500);
                res.send("Request failed: server error.");
                return;
            }

            for(var i = 0; i < ids.length; i++){
                if(ids[i] in SOCKETS){
                    for(var j = 0; j < SOCKETS[ids[i]].length; j++){
                        SOCKETS[ids[i]][j].join(data._id);
                    }
                }
            }

            fetchUserNames(data.users, function(res){
                data.users = res;

                io.to(data._id).emit("new chat", {
                    _id: data._id,
                    users: data.users
                });
            });

            res.status(200);
            res.send("Ok.");
        })});
});

/**
 * Changes a user's screen name.  Parameters are provided in the POST request as a JSON object.
 */
app.post("/user/screen-name", function(req, res){
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
    if(!req.body.screenName){
        res.status(400);
        res.send("Request failed: missing 'screenName' field.");
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
              function(data, err){
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

    db.query("users", {
        email: req.body.email,
        authTokens: {$in: [req.body.authToken]}
    }, function(data, err){
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

            replaceIdsWithNames = function(lst, single, cb){
                fetchUserNames(lst, function(resLst){
                    fetchUserNames([single], function(resSingle){
                        resSingle = resSingle[0];
                        cb(resLst, resSingle);
                    });
                });
            };

            replaceAll = function(full, cb, res){
                if(res === undefined){
                    res = [];
                }
                if(full.length == 0){
                    cb(res);
                    return;
                }
                replaceIdsWithNames(full[full.length-1].users, full[full.length-1].messages[0]? full[full.length-1].messages[0].sender : null, function(lst, sin){
                    res.push(full[full.length-1]);
                    res[res.length-1].users = lst;
                    if(res[res.length-1].messages[0]){
                        res[res.length-1].messages[0].sender = sin;
                    }
                    full.pop();
                    replaceAll(full, cb, res);
                });
            };

            replaceAll(dat, function(ret){
                res.status(200);
                res.send(ret);
            });            
        });
    });
});

/**
 * Returns a list of previous messages for a given chat.  Parameters are provided in the POST request as a JSON object.
 */
app.post("/chat/history", function(req, res){
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
    var page = 0;
    if(req.body.page){
        page = req.body.page;
    }

    db.query("users", {
        email: req.body.email,
        authTokens: {$in: [req.body.authToken]}
    }, function(data, err){
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
        var hash = crypto.createHash("sha512");
        password = hash.update(password).update(salt).digest("base64");
    }
    return password;
}


/**
 * Returns a list of user IDs given a list of user emails.
 * @param {array} data The list of user emails 
 * @param {function} cb Callback function taking a single parameter, the list of user IDs
 * @param {array} res The current user ID list; don't specify anything for this field, as it is only used for recursive calls
 */
var fetchUserIds = function(data, cb, res){ // TODO: redo this mess with closures and asynchandler
    if(data.length == 0){
        cb(res);
        return;
    }

    if(res === undefined){
        res = [];
    }

    db.query("users", {
        email: data[data.length-1]
    },
             function(dat, err){
        if(!err){
            data.pop();
            if(dat[0]){
                res.push(ObjectId(dat[0]._id));
            }
            fetchUserIds(data, cb, res);
        }
    });
}


/**
 * Returns a list of usernames given a list of user IDs.
 * @param {array} data The list of user IDs
 * @param {function} cb Callback function taking a single parameter, the list of usernames
 * @param {array} res The current username; don't specify anything for this field, as it is only used for recursive calls
 */
var fetchUserNames = function(data, cb, res){ // TODO: redo this mess with closures and asynchandler
    if(data.length == 0){
        cb(res);
        return;
    }

    if(res === undefined){
        res = [];
    }

    db.query("users", {
        _id: ObjectId(data[data.length-1])
    },
             function(dat, err){
        if(!err){
            data.pop();
            if(dat[0]){
                res.push(dat[0].screenName)
            };
            fetchUserNames(data, cb, res);
        }
    });
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
                 function(data, err){
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
        }, function(data, err){
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
                 function(data, err){
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
                          function(data, err){});
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
        }, function(data, err){
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

// DEBUG: prints out the SOCKETS object every 20 seconds
setInterval(function(){
    console.log();
    for(x in SOCKETS){
        console.log(x + ": " + SOCKETS[x].length);
    }
    console.log();
}, 20000);
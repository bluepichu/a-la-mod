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
var emailValidator = require("email-validator");
var cryptoString = require("random-crypto-string");

var connect_handlebars = require("connect-handlebars");
app.use("/templates/templates.js", connect_handlebars(__dirname + "/../public/templates", {
    exts: ["hbs"]
}));

var HASH_COUNT = 2;  // Number of times passwords are hashed.  DO NOT CHANGE, AS IT WILL BREAK OLD ACCOUNTS.
var PAGE_SIZE = 2e9;  // Number of chat results to return in a single request.

var PLAINTEXT_COMM = ObjectId("54cc2db98c8b2e4fc87cbcb1");

var SOCKETS = {}; // Stores currently authorized sockets, as {<user id>: [<list of connected sockets authorized with user id>]}

var PORT = process.env.PORT || 1337; // Sets the socket to whatever the evironment specifies, or 1337 if a port is not specified

var sendgridlogin = require("sendgrid");
var sendgrid = undefined;

var local = false;
if (process.argv[2] == "-l") {
    local = true;
}

if (process.env.SGPASS) {
    sendgrid = sendgridlogin("a-la-mod",process.env.SGPASS);
    
} else {
    console.log("Missing SGPASS environment variable. Will not be able to verify email addresses");
}

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

/**
 * Creates a new user.  Parameters are provided in the POST request as a JSON object.
 */
app.post("/user/new", function(req, res){
    console.log(req.body);
    var chk = argCheck(req.body, {email: "string", password: "string"});
    console.log (chk);
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

        var verID = crypto.randomBytes(32).toString("hex");
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
                console.log("user inserted.");
                res.status(200);
                res.send("Ok. Verification ID is "+verID);
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
    if(!argCheck(req.body,{title: "string", users: "object"}).valid) {
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
            title: req.body.title,
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
    var chk = argCheck(req.body, {email: "string", authToken: "string", screenName: "string"});
    console.log (chk);
    if(!chk.valid) {
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
        console.log(data, err);

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

        cryptoString(12, function(err, password){
            console.log(password); // REMOVE THIS LINE IN PRODUCTION
            var hash = passwordHash(password, data[0].salt);
            db.update("users", {email: req.body.email}, {$set: {password: hash}}, function(err, data){
                // TODO: send data containing password
                res.status(200);
                res.send();
            });
        });
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
                   function(er, dat){
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
                        screenName: da.screenName
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
            io.to(socket.id).emit("login", null, {id: data[0]._id, contacts: data[0].contacts, email: data[0].email, screenName: data[0].screenName});
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
                     function(er, dat){
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
     * Emits a request to add a comm to a given chat.
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
     * Emits a message sent by a user.
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
                     function(er, dat){
                if(er || !dat){
                    // ???
                    io.to(socket.id).emit("error", {description: "Request failed: server error."});
                    return;
                }

                io.to(chatId).emit("message", chatId, {
                    sender: {email: socket.email, _id: socket.userId, screenName: dat[0].screenName},
                    comm: comm,
                    message: msg,
                    timestamp: moment().unix()
                }); // comm will probably be a part of this later

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

var sendVerEmail = function(verID, emailaddr, username) {
    if (!sendgrid) {
        console.log("Error, cannot send verification email");
        return
    }
    var email = new sendgrid.Email({fromname: "A-la-mod"})
    email.addTo(emailaddr);
    email.setFrom("donotreply@a-la-mod.herokuapp.com");
    email.setSubject("Verify Your Email");
    email.setHtml("<h1 style='font-family:basic;font-size:60px;color:rgb(21,101,192);text-align:center;width:100%'>Welcome to A la Mod</h1><br><p style='margin-left: 30px; margin-right: 30px'>Before you can start using A la Mod, we ask that you verify your email. Click <a href='http://a-la-mod.herokuapp.com/user/verify/"+verID+"'>here</a> to verify.</p>");
    sendgrid.send(email, function(err, data) {
        if (err) {
            console.log (err);
        } else {
            console.log(data);
        }
    });
}

// DEBUG: prints out the SOCKETS object every 20 seconds
setInterval(function(){
    console.log();
    for(x in SOCKETS){
        console.log(x + ": " + SOCKETS[x].length);
    }
    console.log();
}, 20000);

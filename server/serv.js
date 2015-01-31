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

var POST = "POST";
var GET = "GET";

var HASH_COUNT = 1726;
var PAGE_SIZE = 2e9;

var PLAINTEXT_COMM = ObjectId("54cc2db98c8b2e4fc87cbcb1");

var SOCKETS = {};

var PORT = process.env.PORT || 1337;

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

app.get("/css/:file", function(req, res){
    res.sendFile("/css/" + req.params.file, {root: path.join(__dirname, "../public")});
});

app.get("/js/:file", function(req, res){
    res.sendFile("/js/" + req.params.file, {root: path.join(__dirname, "../public")});
});

app.get("/images/:file", function(req, res){
    res.sendFile("/images/" + req.params.file, {root: path.join(__dirname, "../public")});
});

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
            icon: null,
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

app.post("/chat/new", function(req, res){ // TODO: This should require auth
    if(!req.body.users){
        res.status(400);
        res.send("Request failed: missing users list.");
        return;
    }
    fetchUserIds(req.body.users, function(ids){
        db.insert("chats", {
            users: ids,
            comms: [PLAINTEXT_COMM],
            messages: []
        },
                  function(data, err){
            if(err){
                res.status(500);
                res.send("Request failed: server error.");
                return;
            }
            // emit notif to involved sockets here
            res.status(200);
            res.send("Ok.");
        })});
});

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
            users: 1
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
                replaceIdsWithNames(full[full.length-1].users, full[full.length-1].messages[0].sender, function(lst, sin){
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
            users: {$in: [data[0]._id]}
        }, {
            messages: {$slice: [-(page+1)*PAGE_SIZE, PAGE_SIZE]}
        },
                   function(dat, er){
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
            for(var i = 0; i < dat[0].messages.length; i++){
                dat[0].messages[i].you = dat[0].messages[i].sender.toString() == data[0]._id.toString();
            }
            res.status(200);
            res.send(dat[0].messages);
        });
    });
});

http.listen(PORT, function(){
    console.log("listening on *:" + PORT);
});

var passwordHash = function(password, salt){
    for(var i = 0; i < HASH_COUNT; i++){
        var hash = crypto.createHash("sha512");
        password = hash.update(password).update(salt).digest("base64");
    }
    return password;
}

var fetchUserIds = function(data, cb, res){
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
            res.push(ObjectId(dat[0]._id));
            fetchUserIds(data, cb, res);
        }
    });
}

var fetchUserNames = function(data, cb, res){
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
            res.push(dat[0].screenName);
            fetchUserNames(data, cb, res);
        }
    });
}

io.on("connection", function(socket){
    socket.on("login", function(user, auth){
        if(socket.userId){
            io.to(socket.id).emit("error", {description: "Logon failed: you're alerady logged in!"});
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
                io.to(socket.id).emit("error", {description: "Login failed: server error."});
                return;
            }
            if(data.length != 1){
                io.to(socket.id).emit("error", {description: "Login failed: invalid auth token."});
                return;
            }
            io.to(socket.id).emit("success", {description: "Login succeeded."});
            console.log("Login succeeded.");
            socket.userId = data[0]._id;
            socket.email = data[0].email;
            console.log(socket.userId);
            if(!(socket.userId in SOCKETS)){
                SOCKETS[socket.userId] = [];
            }
            SOCKETS[socket.userId].push(socket);
        });
    });

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
                for(var i = 0; i < data[0].users.length; i++){
                    console.log(data[0].users[i]);
                    if(data[0].users[i] in SOCKETS){
                        console.log("doing thing");
                        for(var j = 0; j < SOCKETS[data[0].users[i]].length; j++){
                            console.log("safasdfs", data[0].users[i], socket.userId);
                            io.to(SOCKETS[data[0].users[i]][j].id).emit("message", chatId, socket.userId, dat[0].screenName, data[0].users[i].toString() == socket.userId.toString(), msg); // comm will probably be a part of this later
                        }
                    }
                }

                db.update("chats", {
                    _id: ObjectId(chatId)
                },
                          {
                    $push: {messages: {
                        sender: dat[0]._id,
                        comm: comm,
                        message: msg
                    }}
                },
                          function(data, err){});
            });
        });
    });

    socket.on("commrequest", function(){

    });
});


setInterval(function(){
    console.log();
    for(x in SOCKETS){
        console.log(x + ": " + SOCKETS[x].length);
    }
    console.log();
}, 20000);

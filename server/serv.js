var express = require("express");
var app = express();
var bodyparser = require("body-parser");
app.use(bodyparser.json());
var http = require("http").Server(app);
var io = require("socket.io")(http);
var path = require("path");
var crypto = require("crypto");
var db = require("./db");

var POST = "POST";
var GET = "GET";

var HASH_COUNT = 1726;

app.get("/", function(req, res){
    console.log("lol");
    res.sendFile("/index.html", {root: path.join(__dirname, "../public")});
});

app.post("/user/new", function(req, res){
    if(!req.body.email){
        res.send("Request failed: missing 'email' field.");
        return;
    }
    if(!req.body.password){
        res.send("Request failed: missing 'password' field.");
        return;
    }
    if(! /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,4}$/.test(req.body.email)){
        res.send("Request failed: 'email' value does not follow the proper format.");
        return;
    }

    db.query("users", {email: req.body.email}, function(data, err){
        if(err || data.length > 0){
            console.log("Rejected.");
            res.send("Request failed: this email is associated with another account.");
            return;
        }
        var salt = crypto.randomBytes(256).toString("base64");
        var password = req.body.password;

        for(var i = 0; i < HASH_COUNT; i++){
            var hash = crypto.createHash("sha512");
            password = hash.update(password).update(salt).digest("base64");
        }

        db.insert("users", {
            email: req.body.email,
            password: password,
            salt: salt
        }, function(data, err){
            if(err){
                // wtf
            } else {
                console.log("user inserted.");
                res.send("Ok.");
            }
        });
    });
});

io.on("connection", function(socket){
    socket.on("chat message", function(msg){
        io.emit("chat message", msg);
    });
});

http.listen(1337, function(){
    console.log("listening on *:1337");
});
var app = require("express")();
var http = require("http").Server(app);
var io = require("socket.io")(http);
var path = require("path");

app.get("/", function(req, res){
    res.sendFile("/index.html", {root: path.join(__dirname, "../public")});
});

io.on("connection", function(socket){
    socket.on("chat message", function(msg){
        io.emit("chat message", msg);
    });
});

http.listen(1337, function(){
    console.log("listening on *:1337");
});
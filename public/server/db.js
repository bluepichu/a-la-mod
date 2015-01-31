var mjs = require("mongojs");
var db = mjs.connect("localhost:27017/chat-mod", ["users", "chats"]);
var ObjectId = mjs.ObjectId;

console.log("DB connected.");

var query = function(table, query, cb){
    console.log("QUERY: " + query.toString());
    db[table].find(query, function(err, data){
        if(err){
            cb(null, err);
        } else {
            cb(data, null);
        }
    });
};

var insert = function(table, data, cb){
    console.log("INSERT: " + data.toString());
    db[table].save(data, function(err, data){
        if(err){
            cb(null, err);
        } else {
            cb(data, null);
        }
    });
};

var update = function(table, query, data, cb){
    console.log("UPDATE:");
    console.log(query.toString());
    console.log(data.toString());
    db[table].update(query, data, function(err, data){
        if(err){
            return cb(null, err);
        } else {
            return cb(data, null);
        }
    });
};

module.exports = {
    query: query,
    insert: insert,
    update: update,
    ObjectId: ObjectId
}
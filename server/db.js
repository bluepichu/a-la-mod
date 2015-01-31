var mjs = require("mongojs");
var dbPath = "mongodb://exchange:modify@ds039431.mongolab.com:39431/heroku_app33623467";
var db = mjs.connect(dbPath, ["users", "chats", "comms"]);
var ObjectId = mjs.ObjectId;

console.log("DB connected.");

var query = function(table, query, cb){
    console.log("QUERY: " + JSON.stringify(query));
    db[table].find(query, function(err, data){
        if(err){
            cb(null, err);
        } else {
            cb(data, null);
        }
    });
};

var project = function(table, query, projection, cb){
    console.log("PROJECT:");
    console.log(JSON.stringify(query));
    console.log(JSON.stringify(projection));
    db[table].find(query, projection, function(err, data){
        if(err){
            cb(null, err);
        } else {
            cb(data, null);
        }
    });
};

var query = function(table, query, cb){
    console.log("QUERY: " + JSON.stringify(query));
    db[table].find(query, function(err, data){
        if(err){
            cb(null, err);
        } else {
            cb(data, null);
        }
    });
};

var insert = function(table, data, cb){
    console.log("INSERT: " + JSON.stringify(data));
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
    console.log(JSON.stringify(query));
    console.log(JSON.stringify(data));
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
    project: project,
    ObjectId: ObjectId
}
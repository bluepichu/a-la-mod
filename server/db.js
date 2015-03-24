var mjs = require("mongojs");
var dbPath = "mongodb://exchange:modify@ds039431.mongolab.com:39431/heroku_app33623467";
if(process.argv[2] == "-l"){
    console.log("RUNNING LOCALLY");
    dbPath = "mongodb://localhost:27017/a-la-mod";
}
var db = mjs.connect(dbPath, ["users", "chats"]);
var ObjectId = mjs.ObjectId;

console.log("DB connected @ " + dbPath);

/**
 * Returns the result of a database query.
 * @param {string} collection The collection on which to run the query
 * @param {object} query The query to run on the collection (formatted mongo-style)
 * @param {function} cb Callback function for completion, taking two arguments - the data on a succesful request and the error on an unsuccesful one
 */
var query = function(collection, query, cb){
    console.log("QUERY: " + JSON.stringify(query));
    db[collection].find(query, function(err, data){
        if(err){
            cb(err, null);
        } else {
            cb(null, data);
        }
    });
};

/**
 * Returns the result of a database query projected onto the projection object.
 * @param {string} collection The collection on which to run the query
 * @param {object} query The query to run on the collection (formatted mongo-style)
 * @param {object} query The object on which to project the query (formatted mongo-style)
 * @param {function} cb Callback function for completion, taking two arguments - the data on a succesful request and the error on an unsuccesful one
 */
var project = function(collection, query, projection, cb){
    console.log("PROJECT:");
    console.log(JSON.stringify(query));
    console.log(JSON.stringify(projection));
    db[collection].find(query, projection, function(err, data){
        if(err){
            cb(err, null);
        } else {
            cb(null, data);
        }
    });
};


/**
 * Inserts an item into a collection.
 * @param {string} collection The collection into which to insert the data
 * @param {object} data The data to insert into the collection
 * @param {function} cb Callback function for completion, taking two arguments - the data on a succesful request and the error on an unsuccesful one
 */
var insert = function(collection, data, cb){
    console.log("INSERT: " + JSON.stringify(data));
    db[collection].save(data, function(err, data){
        if(err){
            cb(err, null);
        } else {
            cb(null, data);
        }
    });
};


/**
 * Updates a set of items in a collection.
 * @param {string} collection The collection in which to update records
 * @param {object} query The query to run on the collection to select items to update (formatted mongo-style)
 * @param {object} data The updates to perform on the selected records (formatted mongo-style)
 * @param {function} cb Callback function for completion, taking two arguments - the data on a succesful request and the error on an unsuccesful one
 */
var update = function(collection, query, data, cb){
    console.log("UPDATE:");
    console.log(JSON.stringify(query));
    console.log(JSON.stringify(data));
    db[collection].update(query, data, function(err, data){
        if(err){
            cb(err, null);
        } else {
            cb(null, data);
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

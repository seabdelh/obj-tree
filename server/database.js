const MongoClient = require('mongodb').MongoClient;
const ObjectId = require('mongodb').ObjectID;

// Connection URL
const url = 'mongodb://localhost:27017';
// Database Name
const dbName = 'objTreeDB';
var db = null;
var DB = {
  // Use connect method to connect to the db
  connect: function(cb) {
    MongoClient.connect(url, function(err, client) {
      if (!err)
        db = client.db(dbName);
      else
        db = null;
      cb(err, db);
    });
  },
  getAll: function(cb) {
    db.collection('objTree').find({}).toArray((err, result) => {
      cb(err, result);
    });
  },
  insert: function(doc, cb) {
    db.collection('objTree').insert(doc, (err, result) => {
      cb(err, result);
    });
  },
  delete: function(doc, cb) {
    db.collection('objTree').deleteOne(doc, (err, result) => {
      cb(err, result);
    });
  },
  update: function(doc, cb) {
    const newvalues = { $set: {code:doc.code,name:doc.name} };
    db.collection('objTree').updateOne({_id:ObjectId(doc._id)},newvalues, (err, result) => {
      cb(err, result);
    });
  }
};
module.exports = DB;
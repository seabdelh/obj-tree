const express = require('express')
const app = express()
const database = require('./database')
const assert = require('assert');
const bodyParser = require("body-parser");
const cors = require('cors')

app.use(bodyParser.urlencoded({
    extended: true
}));

app.use(bodyParser.json());
app.use(cors());

database.connect((err, db) => {
  assert.equal(null, err);
  console.log('Connected successfully to db');
  app.listen(3000, () => console.log('objTree listening on port 3000!'))
})

app.get('/', (req, res) => {
  res.send('APIs: insert, delete, update, getAll');
})
app.get('/getAll', (req, res) => {database.getAll((err, result) => {
                     res.send(result);
                   })})
app.post('/insert', function(req, res) {
  database.insert(req.body, (err, result) => {res.send({result})})
})
app.post('/delete', function(req, res) {
  database.delete(req.body, (err, result) => {res.send({result})})
})
app.post('/update', function(req, res) {    
  database.update(req.body, (err, result) => {res.send({result})})
})
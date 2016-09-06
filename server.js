//
// FCC Image Search Abstraction Layer
// Copyright (C) 2016 Nirix
//
var https = require('https');
var express = require('express');
var mongoose = require('mongoose');
var router = express();

// Configuration
var config = {
  bing_sub_key: process.env.BING_SUB_KEY,
  mongo: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost/fcc-image-search-al',
    options: {
      db: {
        safe: true
      }
    }
  }
};

// Mongoose
mongoose.connect(config.mongo.uri, config.mongo.options);
mongoose.connection.on('error', function(err){
  console.log('Exiting due to MongoDB connection error: ' + err);
  process.exit(-1);
});

// History schema / model
var historySchema = new mongoose.Schema({
  term: String,
  when: String
});

var History = mongoose.model('History', historySchema);

router.get('/', function(req, res){
  res.send([
    '<h1>Image Search Abstraction Layer</h1>',
    'Search:',
    '<code>GET /search/{query}</code><br>',
    'Latest/history:',
    '<code>GET /latest</code>'
  ].join('<br>'));
});

router.get('/latest', function(req, res) {
  History.find({}, null, {
    limit: 10,
    sort: {
      when: -1
    }
  }, function(err, items){
    if (err) {
      return res.status(500).send(err);
    }

    res.json(items.map(function(item){
      return {
        term: item.term,
        when: item.when
      }
    }));
  });
});

router.get('/search/:query', function(req, res){
  var query = encodeURI(req.params.query);
  var body = '';

  https.request({
    host: 'api.cognitive.microsoft.com',
    path: '/bing/v5.0/images/search?q=' + query + '&offset=' + (req.query.offset || 0),
    method: 'GET',
    headers: {
      'Ocp-Apim-Subscription-Key': config.bing_sub_key
    }
  }, function(resp) {
    resp.setEncoding('utf8');

    // Build body
    resp.on('data', function(data) {
      body += data;
    });

    // Build response
    resp.on('end', function(){
      var json = JSON.parse(body);
      var items = [];

      json.value.forEach(function(item){
        items.push({
          url: item.contentUrl,
          snippet: item.name,
          thumbnail: item.thumbnailUrl,
          context: item.hostPageUrl
        });
      });

      History.create({
        term: req.params.query,
        when: new Date().toLocaleString()
      });

      res.json(items);
    });
  }).on('error', function(err){
    res.status(500).send(err);
  }).end();
});

router.listen(process.env.PORT || 3000, function(){
  console.log('Server listening on port', process.env.PORT || 3000)
});

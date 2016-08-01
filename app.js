/**
 * Module dependencies.
 */

try {
  var env = require('./.env.js');
  for (var key in env) {
    if (!(key in process.env))
      process.env[key] = env[key];
  }
} catch(ex) {
  console.log('error loading .env.js');
}


var express = require('express'),
app = express(),
watson = require('watson-developer-cloud'),
vcapServices    = require('vcap_services'),
extend          = require('util')._extend,
server = require('http').createServer(app),
io = require('socket.io').listen(server);

//Bootstrap application settings
require('./config/express')(app,io);
server.listen(app.get('port'));
console.log('server running on 3000');

var indexRt = require('./routes/approutes')(app,io);

//error-handler application settings
require('./config/error-handler')(app);

//For local development, replace username and password
var speechToTextConfig = extend({
  version: 'v1',
 }, vcapServices.getCredentials('speech_to_text'));

var authService = watson.authorization(speechToTextConfig);
//Get token using your credentials
app.post('/api/token', function(req, res, next) {
  authService.getToken({
    url: 'https://stream.watsonplatform.net/speech-to-text/api'
  }, function(err, token) {
	  if (err){
		  next(err);
	  } else {
		  res.send(token);
	  }
  });
});
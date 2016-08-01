
/*
 * GET home page.
 */
var watson = require('watson-developer-cloud'),
streamToText = require('../src/streamToText.js'),
vcapServices    = require('vcap_services'),
extend          = require('util')._extend,
request = require('request');
global.watsonConnections = {};
global.reqCount = 0;
var timeInterval;
module.exports = function (app,io) {
	app.get('/', function (req, res) {
		res.sendFile( __dirname + '/index.html');
	});

	app.get("/player",function(req,resp){
		resp.sendFile(__dirname +'/streamtext.html');
	});

	var socket1 = io.of('/speechsocket');
	socket1.on('connection', function(socket){
		var crtReqCount = ++reqCount;
		console.log('::initsocket. reqCount is:'+ crtReqCount);
		var streamId = 'stream';//default stream name
		var watsonStrmLstnrs = {};
		socket.on('sendMessage', function(req){
			var watsonSpeechArray=[];
			// console.log('streamId', req.streamId);
			var event = req.streamId;
			delay=req.delay;
			//  console.log('Delay',delay);

			if(event) {
				streamId =  event;
			}
			
			//For local development, replace username and password
			var speechToTextConfig = extend({
			  version: 'v1'
			}, vcapServices.getCredentials('speech_to_text'));

			

			var speechToText = watson.speech_to_text(speechToTextConfig);

			streamToText.getStreamText(request,streamId,speechToText,function(result){
				if(result!=""){
					watsonSpeechArray.push(result); 
				}
			},function(listenersObj) {
				watsonStrmLstnrs = listenersObj;
			}) ;

			timeInterval = setInterval(function(){
				var nResult='';
				if(watsonSpeechArray.length>0){
					nResult=watsonSpeechArray[0];
					watsonSpeechArray.shift();  
					var id= new Date().getMilliseconds();
					socket.emit('message','<div id="node_'+id+'" style= "color:#fff;font-family: Verdana, sans-serif;font-size: 16px; display: inline-block; line-height:25px;background:black;">'+nResult+'</div>');
				}
			}, delay);
		});
		socket.on('disconnect', function(data){
			console.log('called disconnect socket for request number'+crtReqCount);
			console.log(JSON.stringify(data, null, 2));
			clearInterval(timeInterval);
			socket.disconnect(); 
			['data', 'results', 'error', 'close-connection'].forEach(function(eventName) {
				if(watsonConnections[streamId]!=null && watsonStrmLstnrs[eventName] !=null) 
					watsonConnections[streamId].recognizeStream.removeListener(eventName,watsonStrmLstnrs[eventName]);
			});
			console.log('recognizeStream Handlers removal success for request number'+crtReqCount);
		});
	});


};
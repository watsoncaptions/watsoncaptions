function formatResult(msg, baseString) {
	if (msg.results && msg.results.length > 0) {
		//var alternatives = msg.results[0].alternatives;
		var text = msg.results[0].alternatives[0].transcript || '';

		// apply mappings to beautify
		text = text.replace(/%HESITATION\s/g, '');
		text = text.replace(/([^*])\1{2,}/g, '');

		text = text.replace(/D_[^\s]+/g,'');

		// if all words are mapped to nothing then there is nothing else to do
		if ((text.length === 0) || (/^\s+$/.test(text))) {
			return baseString;
		}

		// capitalize first word
		// if final results, append a new paragraph
		if (msg.results && msg.results[0] && msg.results[0].final) {
			text = text.slice(0, -1);
			text = text.charAt(0).toUpperCase() + text.substring(1);  
			text = text.trim() + '. ';
			baseString += text;
		}
	}
	return baseString;
}

function listenWatsonStream(streamId,showResponse,assignListeners) {
	var watsonConnObj = watsonConnections[streamId];
	if(watsonConnections[streamId]!=null) {
	console.log('Watson session Id: '+ watsonConnObj.sessionId+' . for request with reqCount: '+reqCount);
	var recognizeStream = watsonConnObj.recognizeStream;
	recognizeStream.setMaxListeners(recognizeStream.getMaxListeners() + 1);
	var baseString = '';
	var finalString = '';
	var listenersObj = {};
	
	function onReadStream(resultsResponse) {
	    finalString = baseString;
		baseString = formatResult(resultsResponse,baseString);
        finalString = baseString.substring(finalString.length);  
		showResponse(finalString);
	  }
	function onStreamError(error) {
		 //console.log('recognizeStream error: '+error);
		 //showResponse('Error reading stream. Please try later');
		console.log('recognizeStream error: '+error);
		['data', 'results', 'error', 'close-connection'].forEach(function(eventName) {
			recognizeStream.removeAllListeners(eventName);
			watsonConnections[streamId] = null;
		});
	}
	function onStreamConClose(event) {
		//console.log('connection-closed '+event);
		//showResponse('Connection closed to stream. Please try later');
		console.log('recognizeStream error: '+error);
		['data', 'results', 'error', 'close-connection'].forEach(function(eventName) {
			console.log('connection-closed '+event);
			recognizeStream.removeAllListeners(eventName);
			watsonConnections[streamId] = null;
		});
	}
	    
	['data', 'results'].forEach(function(eventName) {
		recognizeStream.on(eventName, onReadStream);
	});
	
	recognizeStream.once('error', onStreamError);
	
	recognizeStream.once('close-connection',  onStreamConClose);
	
	['data', 'results', 'error', 'close-connection'].forEach(function(eventName) {
		var lstnrArray = recognizeStream.listeners(eventName);
		var latestAddedLstnr = lstnrArray[lstnrArray.length-1];
		listenersObj[eventName] = latestAddedLstnr;
	});
	assignListeners(listenersObj);
	
	} else {
		showResponse('Server error. Unable to add listeners to recognizeStream');
		return;
	}
}

var streamToText = module.exports;
streamToText.getStreamText = function(req,streamId,speechToText,showResponse,assignListeners){ 
	if(watsonConnections[streamId]==null) {
		//New watson STT connection intialized if streamId is null
		connectWatsonSTT(req,streamId,speechToText,showResponse,assignListeners);
	} else {
		var watsonConnObj = watsonConnections[streamId];
		// Checking if recognize stream  readable is true or false.. If true then we will use existing recognize object else estanlish new conenction
		if(watsonConnObj.recognizeStream.readable){
			
			listenWatsonStream(streamId,showResponse,assignListeners);
		}else{
			console.log('New connection establishing::::');
			connectWatsonSTT(req,streamId,speechToText,showResponse,assignListeners);
		}
		/*var params = {
				  session_id: watsonConnObj.sessionId,
				  cookie_session: watsonConnObj.cookie_session
				};

		speechToText.getRecognizeStatus(params, function(error, status) {
				  if (error)
				    console.log('error while getting session status:', error);
				  else
				    console.log(JSON.stringify(status, null, 2));
				});*/
		
		   
	}
}

//Connecting to Watson STT service
function connectWatsonSTT(req,streamId,speechToText,showResponse,assignListeners){

	var watsonConnObj = {};
	speechToText.createSession({}, function(err, session){ 
		if (err){
			console.log('Error while connecting to Watson STT:', err);
			return;
		} else {
			console.log(JSON.stringify(session, null, 2));
		}
		watsonConnObj.sessionId = session.session_id;
		watsonConnObj.cookie_session = session.cookie_session;
		var params = {

				content_type: 'audio/ogg;codecs=opus',
				//  transfer-encoding: 'chunked',
				interim_results: true,
				inactivity_timeout: 50,
				continuous: true,
				session_id: session.session_id,
				cookie_session: session.cookie_session
		};
		// create the stream
		var recognizeStream = speechToText.createRecognizeStream(params);
		speechToText.getRecognizeStatus(params,function(error,status){
			if (error)
			    console.log('error:', error);
			  else
			    console.log(JSON.stringify(status, null, 2));
			});
	
		req('http://cap-sg-prd-3.integration.ibmcloud.com:17547/'+streamId+'.ogg').pipe(recognizeStream).on('error', function(error){
			console.log('Server error. Request to icecast server for '+streamId+' failed. '+error);
			//showResponse('Server error. Could not connect to '+streamId+'. Please try again later');
			['data', 'results', 'error', 'close-connection'].forEach(function(eventName) {
				recognizeStream.removeAllListeners(eventName);
				watsonConnections[streamId] = null;
			});
		});
		recognizeStream.setEncoding('utf8'); // to get strings instead of Buffers from `data` events
		watsonConnObj.recognizeStream = recognizeStream;
		watsonConnections[streamId] = watsonConnObj;
		listenWatsonStream(streamId,showResponse,assignListeners);
	});

}


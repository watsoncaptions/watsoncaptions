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
		 console.log('recognizeStream error: '+error);
		    showResponse('Error reading stream. Please try later');
		    global.watsonConnections[streamId] = null;
	}
	function onStreamConClose(event) {
		console.log('connection-closed '+event);
		showResponse('Connection closed to stream. Please try later');
		global.watsonConnections[streamId] = null;
	}
	    
	['data', 'results'].forEach(function(eventName) {
		recognizeStream.on(eventName, onReadStream);
	});
	
	recognizeStream.on('error', onStreamError);
	
	recognizeStream.on('close-connection',  onStreamConClose);
	
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
		var watsonConnObj = {};
		speechToText.createSession({}, function(err, session){ 
			if (err){
				console.log('error:', err);
				return;
			} else {
				console.log(JSON.stringify(session, null, 2));
			}
			watsonConnObj.sessionId = session.session_id;
			var params = {

					content_type: 'audio/ogg;codecs=opus',
					//  transfer-encoding: 'chunked',
					interim_results: true,
					inactivity_timeout: 30,
					continuous: true,
					session_id: session.session_id,
					cookie_session: session.cookie_session
			};
			// create the stream
			var recognizeStream = speechToText.createRecognizeStream(params);
			req('http://cap-sg-prd-3.integration.ibmcloud.com:17547/'+streamId+'.ogg').pipe(recognizeStream).on('error', function(error){
				console.log('Server error. Request to icecast server for '+streamId+' failed. '+error);
				showResponse('Server error. Could not connect to '+streamId+'. Please try again later');
			});
			recognizeStream.setEncoding('utf8'); // to get strings instead of Buffers from `data` events
			watsonConnObj.recognizeStream = recognizeStream;
			watsonConnections[streamId] = watsonConnObj;
			listenWatsonStream(streamId,showResponse,assignListeners);
		});
	} else {
		listenWatsonStream(streamId,showResponse,assignListeners);
	}
};


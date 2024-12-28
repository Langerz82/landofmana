var _ = require('underscore'),
		MobSpeech = require("../../shared/data/mobs_speech.json");

var speech = {};
_.each( MobSpeech, function( value, key ) {
	//console.info(JSON.stringify(value));
	speech[key] = value;

});

//console.info(JSON.stringify(speech));
module.exports.Speech = speech;

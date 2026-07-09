import _ from 'underscore';
import MobSpeech from "../../shared/data/mobs_speech.json" with { type: 'json' };

const speech = {};
_.each( MobSpeech, function( value, key ) {
	//console.info(JSON.stringify(value));
	speech[key] = value;

});

//console.info(JSON.stringify(speech));
export const Speech = speech;
export default { Speech };

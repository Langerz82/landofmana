// Converted from AMD (define) + RequireJS's text! plugin to a native ES6 module.
// See data/fetchjsonsync.js for why jQuery's synchronous $.ajax is used here instead of fetch()/
// JSON import attributes/Node's fs module.
/* global Types, $ */
import fetchJsonSync from './fetchjsonsync.js';

var MobSpeech = {};
MobSpeech.Speech = {};
var mobParse = fetchJsonSync('shared/data/mobs_speech.json');
$.each(mobParse, function(key, value) {
    MobSpeech.Speech[key] = value;
});

export default MobSpeech;

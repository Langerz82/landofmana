// Converted from AMD (define) + RequireJS's text! plugin to a native ES6 module.
// See data/fetchjsonsync.js for why jQuery's synchronous $.ajax is used here instead of fetch()/
// JSON import attributes/Node's fs module.
/* global Types */
import fetchJsonSync from '../lib/fetchjsonsync.js';

const MobSpeech = {};
MobSpeech.Speech = fetchJsonSync('shared/data/mobs_speech.json');

export default MobSpeech;

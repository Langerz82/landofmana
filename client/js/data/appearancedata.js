// Converted from AMD (define) + RequireJS's text! plugin to a native ES6 module.
// Was: define(['text!../../shared/data/appearance.json'], function(AppearancesJson) {...})
// text! loaded the JSON file's raw contents synchronously at build/load time. Every consumer of
// this module expects a plain array export, not a Promise, so the JSON is loaded synchronously
// via jQuery's AJAX ($.ajax with async: false) instead of fetch() - see data/fetchjsonsync.js.
/* global $ */
import fetchJsonSync from './fetchjsonsync.js';

var Appearances = [];
var appearanceParse = fetchJsonSync('shared/data/appearance.json');

$.each(appearanceParse, function(key, val) {
    Appearances[key] = {
        name: val.name,
        type: val.type,
        sprite: val.sprite,
        buy: val.buy
    };
});

export default Appearances;

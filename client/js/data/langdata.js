// Converted from AMD (define) + Class.extend + RequireJS's text! plugin to a native ES6 module/class.
// See data/fetchjsonsync.js for why jQuery's synchronous $.ajax is used here instead of fetch()/
// JSON import attributes/Node's fs module.
/* global $ */
import fetchJsonSync from '../lib/fetchjsonsync.js';

const LangData = fetchJsonSync('shared/data/lang.json');

export default class Lang {
    constructor(lang) {
        this.lang = lang;
        this.data = LangData[lang];
    }
}

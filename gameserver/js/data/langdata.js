var _ = require('underscore'),
		LangJson = require("../../shared/data/lang.json");

var LangData = {};

_.each( LangJson, function( val, key ) {
	LangData[key] = val;
});

module.exports.Data = LangData;

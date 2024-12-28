var _ = require('underscore'),
		NotifyJSON = require("../../shared/data/notifications.json");

var Notifications = {};
var i = 0;
_.each( NotifyJSON, function( value, key ) {
	Notifications[i++] = {
		textid: value.textid,
		interval: value.interval,
	};
});

module.exports.Notifications = Notifications;

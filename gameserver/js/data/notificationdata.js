import _ from 'underscore';
import NotifyJSON from "../../shared/data/notifications.json" with { type: 'json' };

const Notifications = {};
let i = 0;
_.each( NotifyJSON, function( value, key ) {
	Notifications[i++] = {
		textid: value.textid,
		interval: value.interval,
	};
});

export { Notifications };
export default { Notifications };

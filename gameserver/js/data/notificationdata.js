import _ from 'underscore';
import NotifyJSON from "../../data/notifications.json" with { type: 'json' };

const Notifications = {};
let i = 0;
// FIX: read `value.textid` here, but shared/data/notifications.json's raw
// field is `text` (confirmed against the actual JSON -- there's no `textid`
// key anywhere in it). `value.textid` was always undefined, so
// worldserver.js's periodic world-notification broadcast (self.notify's
// Scheduler.every() loop, which sends `new Messages.Notify("NOTICE",
// notify.textid)` once per configured interval) sent `undefined` as the
// notification text instead of the real message every time it fired. Kept
// the output field named `textid` since that's what worldserver.js already
// reads.
_.each( NotifyJSON, function( value, key ) {
	Notifications[i++] = {
		textid: value.textid,
		interval: value.interval,
	};
});

export { Notifications };
export default { Notifications };

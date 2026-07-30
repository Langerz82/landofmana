import sanitizer from 'sanitizer';
import Utils from '../shared/js/utils.js';

Utils.sanitize = function (string) {
    // Strip unsafe tags, then escape as html entities.
    return sanitizer.escape(sanitizer.sanitize(string));
};

// PERF/FIX: consolidates a `try { throw new Error(); } catch (e) { ...
// e.stack ... }` idiom that was hand-duplicated across ~8 files in
// gameserver/js (pathfinder.js, map/pathfindingservice.js, format.js,
// ws/userconnection.js, entity/entitymoving/entitymovingpath.js,
// updater.js, entity/mob/mobrespawn.js, entity/player/player.js) purely to
// get the current call stack as a string for diagnostic logging. The
// throw/catch was never needed for that -- `new Error()` does not throw on
// its own, and `.stack` is populated the moment the Error is constructed --
// so every one of those sites was paying for exception machinery it didn't
// use. Callers keep using whatever logger they already did
// (console.error/warn/info, log.info, ...); this just replaces the
// boilerplate that produced the string.
Utils.captureStack = function () {
    return new Error().stack;
};

export default Utils;

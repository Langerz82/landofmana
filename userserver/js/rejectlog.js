// Dedicated reject.log: every rejected packet (a formatChecker.check()
// failure in user.js/worldhandler.js, or a raw JSON-parse failure in
// ws/wsbase.js) gets one entry here with both the reason it was rejected
// and the packet itself, written as a ready `replay <packet>` command --
// copy the line, edit/fix the packet's JSON if that's what was wrong with
// it, and paste it straight into the admin console's `Command:` prompt to
// run it (see replay.js for what "run" means -- dispatched as if a
// connected gameserver sent it).
//
// Kept separate from console.log on purpose: console.log still gets a
// short one-line breadcrumb per rejection (see the call sites in
// user.js/worldhandler.js/ws/wsbase.js), not the full packet, so the
// day-to-day log doesn't get cluttered with large packet dumps, while
// every reject is still fully captured here for later triage.
import fs from 'fs';
import util from 'util';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import formatChecker from './format.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 'a' (append), not 'w' -- unlike console.log (main.js), rejects are worth
// keeping across restarts rather than starting fresh every run.
const rejectLogFile = fs.createWriteStream(__dirname + '/../reject.log', {
    flags: 'a'
});

// Runs formatChecker.check(message), capturing every console.info/warn/
// error line format.js itself emits during that one call (the specific
// "which field, why" reason -- see format.js's describeZodError()) instead
// of just the boolean result. format.js's check() has ~20 different
// internal `return false` points, each already logging its own reason via
// console.info/warn/error -- capturing console output around the call,
// rather than touching every one of those return points to also return a
// reason, gets the same result without a much larger, riskier change to a
// heavily-used validator.
//
// The capture still calls through to the real (main.js-patched, tee'd to
// console.log, inspector-visible) console methods -- see main.js's own
// console.log/info/warn/error FIX comment for why calling through instead
// of past them matters -- so format.js's per-field diagnostics keep
// appearing in console.log exactly as before; this only additionally
// collects them to build the reason text below.
//
// check() is fully synchronous (safeParse/CSV-string parsing only, no
// callbacks or promises inside it), so this capture-and-restore around one
// call is safe -- nothing else can run console.info/warn/error on this
// (single-threaded) event loop while it's in progress.
export function checkWithReason(message) {
    const captured = [];
    const original = { info: console.info, warn: console.warn, error: console.error };
    const capture = (fn) => (...args) => {
        captured.push(util.format(...args));
        fn(...args);
    };
    console.info = capture(original.info);
    console.warn = capture(original.warn);
    console.error = capture(original.error);
    let ok;
    try {
        ok = formatChecker.check(message);
    } finally {
        console.info = original.info;
        console.warn = original.warn;
        console.error = original.error;
    }
    return { ok, reason: captured.join(' | ') || '(no reason logged by formatChecker)' };
}

// Appends one entry to reject.log. `reason` is a human-readable line
// (format error text, or a raw JSON-parse error message for a packet that
// never made it past the transport layer). `replayArg` is whatever should
// go right after "replay " to run/re-attempt this exact packet -- callers
// pass JSON.stringify(message) for an already-decoded packet array, or the
// raw wire text as-is (no extra JSON.stringify) for a transport-level
// parse failure -- see replay.js's decodePacketText() for why those need
// different shapes.
export function logRejectedPacket(reason, replayArg) {
    const entry = '[' + new Date().toISOString() + '] ' + reason + '\nreplay ' + replayArg + '\n\n';
    rejectLogFile.write(entry);
}

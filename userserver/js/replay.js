// Lets a rejected packet be copy/pasted back into the admin console
// (`replay <packet>` -- see main.js's getInput()) and run exactly as if a
// connected gameserver had sent it, even though it's coming from the
// command line. Two halves:
//
//   1. Every packet-rejection site (user.js, worldhandler.js, ws/wsbase.js)
//      writes a full entry to reject.log via rejectlog.js's
//      logRejectedPacket() -- the reason it was rejected, plus the packet
//      itself as a ready `replay <packet>` line: copy that whole line,
//      edit/fix the packet's JSON if that's what was wrong with it, and
//      paste it straight into the `Command:` prompt. See rejectlog.js.
//   2. replayPacket() here decodes whatever was pasted back into a message
//      array and dispatches it through a real WorldHandler's real
//      listener -- formatChecker.check() still runs (nothing here bypasses
//      validation), but a packet that passes runs its real handleXXX() for
//      real: database writes, state changes, the works.
//
// worldhandler.js's listener only reaches a handler once
// `self.game_server` is true -- normally set by a real WU_GAMESERVER_INFO
// handshake from an actually-connected gameserver. replayPacket() builds a
// standalone WorldHandler with a stub connection and forces that flag on
// directly, rather than reimplementing worldhandler.js's dispatch switch --
// that keeps this in sync with the real routing for free, and means the
// ONLY thing bypassed is "is a gameserver actually connected". Verified
// this actually reaches the database: a hand-built WU_SAVE_PLAYER_DATA run
// through this path calls all the way through to DBLogic.savePlayerInfo()
// and friends with no live gameserver connection at all, while the same
// packet through an unmodified WorldHandler (game_server left unset) is
// correctly dropped before dispatch -- confirming the gate is real and
// this is genuinely what bypasses it, not an accident.
import zlib from 'zlib';
import WorldHandler from './worldhandler.js';

// Turns whatever text got pasted at the `replay <packet>` prompt into a
// decoded message array (type/action still at index 0 -- what
// formatChecker.check() and listener() both expect). Tries, in order:
//
//   1. A `m=`/`recv[0]=`/`send=` labelled line, straight out of
//      console.log's general per-message traffic log, with the label still
//      attached -- stripped, then handled by cases 2/3 below.
//   2. A bare JSON array, typed or pasted directly, e.g. [507,{"a":1}] --
//      what's left after "replay " is stripped from a reject.log line for
//      a format-check failure (see rejectlog.js's logRejectedPacket()).
//   3. Raw wire text exactly as ws/wsbase.js's _decodeAndDispatch decodes
//      it off a real socket: first character is a flag ('2' = gzip+base64,
//      anything else = plain), the rest is the JSON payload -- what's left
//      after "replay " is stripped from a reject.log line for a
//      transport-level parse failure.
function decodePacketText(rawInput) {
    let text = String(rawInput).trim();

    for (const prefix of ['m=', 'recv[0]=', 'send=']) {
        if (text.startsWith(prefix)) {
            text = text.slice(prefix.length);
            break;
        }
    }

    if (text.startsWith('[')) {
        try {
            const parsed = JSON.parse(text);
            if (Array.isArray(parsed)) return { message: parsed, how: 'a bare JSON array' };
        } catch (e) {
            // fall through to raw-wire decode below
        }
    }

    if (text.length >= 1) {
        const flag = text.charAt(0);
        const payload = text.slice(1);
        try {
            if (flag === '2') {
                const decompressed = zlib.gunzipSync(Buffer.from(payload, 'base64'));
                const parsed = JSON.parse(decompressed.toString());
                if (Array.isArray(parsed)) {
                    return { message: parsed, how: 'raw wire text (flag 2, gzip+base64)' };
                }
            } else {
                const parsed = JSON.parse(payload);
                if (Array.isArray(parsed)) {
                    return { message: parsed, how: 'raw wire text (flag ' + flag + ')' };
                }
            }
        } catch (e) {
            // nothing left to try
        }
    }

    return null;
}

// A minimal stand-in for a real ws/wsbase.js Connection. WorldHandler's
// constructor unconditionally calls `connection.listen(this.listener)`,
// and some handlers call `this.connection.send(...)` to reply -- both need
// to exist and not throw, even though nothing real is attached.
function makeDetachedConnection() {
    return {
        id: 'replay',
        listen() {},
        send(message) {
            console.info(
                'replay: handler tried to reply over the gameserver connection, but this is a ' +
                    'replayed packet with nothing real attached -- dropping: ' +
                    JSON.stringify(message)
            );
        },
        close() {},
        broadcast() {}
    };
}

// Decodes and dispatches ONE pasted packet as if a connected gameserver
// had sent it. See this file's header for exactly what that does and does
// not bypass.
export function replayPacket(rawPacketText) {
    const decoded = decodePacketText(rawPacketText);
    if (!decoded) {
        // Either genuinely undecodable, or (if this came from a
        // reject.log entry for a transport-level parse failure) still
        // malformed the same way it originally was -- either way, nothing
        // to dispatch, and re-attempting JSON.parse here would just repeat
        // whatever error already got logged when it was first rejected.
        console.error(
            'replay: could not decode that as a packet. Paste one of: a full "m=..." line, a bare ' +
                'JSON array like [507,{...}], or raw wire text (flag character + JSON, e.g. ' +
                '"1[507,...]").'
        );
        return;
    }

    console.info('replay: decoded ' + decoded.how + ' -> ' + JSON.stringify(decoded.message));

    const worldHandler = new WorldHandler(global, makeDetachedConnection());
    // The only bypass: normally only a real WU_GAMESERVER_INFO handshake
    // from an actually-connected gameserver sets this. Forcing it here is
    // what makes the real listener treat this packet as if that gameserver
    // sent it, instead of dropping it for having no connection behind it.
    worldHandler.game_server = true;

    console.info('replay: dispatching as if a connected gameserver sent this packet.');

    try {
        worldHandler.listener(decoded.message);
    } catch (e) {
        console.error('replay: dispatch threw: ' + (e && e.stack ? e.stack : e));
        return;
    }

    console.info('replay: dispatched -- see handler output above for the result.');
}

// Lets a rejected packet be copy/pasted from console.log back into the
// admin console (`replay <packet>` -- see main.js's getInput()) and run
// exactly as if a connected gameserver had sent it, even though it's
// coming from the command line. Two halves:
//
//   1. Every packet-rejection site (user.js, worldhandler.js, ws/wsbase.js)
//      logs a `[REJECTED_PACKET]` tagged line via console.info, with the
//      packet captured losslessly via JSON.stringify (see the comments at
//      each of those call sites for why plain string concatenation isn't
//      good enough here -- it mangles any object-valued field, e.g.
//      WU_SAVE_PLAYER_DATA's user-info record, to "[object Object]").
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

const TAG = '[REJECTED_PACKET]';

// Turns whatever text got pasted at the `replay <packet>` prompt into a
// decoded message array (type/action still at index 0 -- what
// formatChecker.check() and listener() both expect). Tries, in order:
//
//   1. A `[REJECTED_PACKET] ... packet=<json>` line -- the tag this file's
//      own reject sites write. Losslessly round-trips any packet shape.
//   2. A `[REJECTED_PACKET] ... raw=<json string>` line -- a transport-
//      level JSON-parse failure (ws/wsbase.js). There's no packet array to
//      dispatch here (that's why it was rejected before one ever existed);
//      returned separately so replayPacket() can report the parse error
//      instead of trying to run it.
//   3. A `m=`/`recv[0]=`/`send=` labelled line with the label still
//      attached -- stripped, then handled by cases 4/5 below.
//   4. A bare JSON array, typed or pasted directly, e.g. [507,{"a":1}].
//   5. Raw wire text exactly as ws/wsbase.js's _decodeAndDispatch decodes
//      it off a real socket: first character is a flag ('2' = gzip+base64,
//      anything else = plain), the rest is the JSON payload.
function decodePacketText(rawInput) {
    const trimmed = String(rawInput).trim();

    const tagIndex = trimmed.indexOf(TAG);
    if (tagIndex !== -1) {
        const rest = trimmed.slice(tagIndex + TAG.length);
        const packetIdx = rest.indexOf('packet=');
        const rawIdx = rest.indexOf('raw=');
        const jsonText =
            packetIdx !== -1
                ? rest.slice(packetIdx + 'packet='.length)
                : rawIdx !== -1
                  ? rest.slice(rawIdx + 'raw='.length)
                  : null;
        if (jsonText === null) return null;
        try {
            const parsed = JSON.parse(jsonText);
            if (Array.isArray(parsed)) return { message: parsed, how: 'a ' + TAG + ' tagged line' };
            if (typeof parsed === 'string') return { rawText: parsed };
        } catch (e) {
            return null;
        }
        return null;
    }

    let text = trimmed;
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
        console.error(
            'replay: could not decode that as a packet. Paste one of: a full "' +
                TAG +
                ' ... packet=..." line, a full "m=..." line, a bare JSON array like [507,{...}], ' +
                'or raw wire text (flag character + JSON, e.g. "1[507,...]").'
        );
        return;
    }

    if (decoded.rawText !== undefined) {
        // A transport-level parse failure -- there's no packet array to
        // dispatch, only the original error to confirm/reproduce.
        try {
            JSON.parse(decoded.rawText);
            console.info('replay: this raw payload now parses as valid JSON -- was the wire format changed?');
        } catch (e) {
            console.info('replay: raw payload still fails JSON.parse the same way: ' + e.message);
        }
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

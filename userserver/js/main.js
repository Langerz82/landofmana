// This file is part of Land of Mana (https://github.com/Langerz82/landofmana).
// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2023-2026 Joshua Langley and contributors
// Portions derived from BrowserQuest (Little Workshop) and BrowserQuest-Asky, MPL-2.0.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, version 3 of the License.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program. See the LICENSE file in the project root,
// or <https://www.gnu.org/licenses/>.

import * as common from './common.js';

import fs from 'fs';
import crypto from 'crypto';
import { redact } from './redact.js';
import bcrypt from 'bcrypt';
import Metrics from './metrics.js';
import ProductionConfig from './productionconfig.js';
import User from './user.js';
import WorldHandler from './worldhandler.js';
//import Utils from './utils.js';
import DatabaseLogic from './database/databaselogic.js';
import { replayPacket } from './replay.js';

// Add these:
// REFACTOR: ws.js was split into ws/ (wsbase.js/socketioconnection.js/
// websocketserver.js/ws.js) -- see that folder's own header comments.
// `ws.WebsocketServer`/`ws.socketioConnection` below are unaffected, same
// external shape as before.
import ws from './ws/ws.js';
import DatabaseSelector from './database/databaseselector.js';

//import _ from 'underscore';
import { createInterface } from 'readline';

import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const readline = createInterface({
    input: process.stdin,
    output: process.stdout
});

const packageName = 'com.retrorpgonline2';

const IO_STATES = {
    MSG_BUYPRODUCT: 1,
    MSG_ERRORPRODUCT: 2
};

// Global setup
import Log from 'log';
import util from 'util';

const log_file = fs.createWriteStream(__dirname + '/../console.log', {
    flags: 'w'
});

// FIX: log_file above was declared but never actually used --
// this server has only ever relied on shell redirection (see
// userserver-linux.sh: `node ./js/main > console.log`) to populate
// console.log, and that redirects stdout only. console.warn/console.error
// write to stderr by default in Node, so every console.warn/error call in
// this codebase (including every packet-rejection log line -- see
// worldhandler.js/user.js/format.js) was silently NOT making it into
// console.log at all under that launch script, only appearing in the
// terminal/tmux pane. That's a problem for anything that wants to inspect
// console.log after the fact -- including the short "-- see reject.log"
// breadcrumb every rejection site now logs (see rejectlog.js) -- the exact
// lines it needs are the ones that were going missing. Wiring log_file up
// directly here, instead of depending on shell redirection, makes
// console.log capture everything (console.log/info/warn/error alike)
// regardless of how the process is launched.
//
// FIX: the first version of this wired log_file up by REPLACING
// console.log/info/warn/error with plain functions that wrote straight to
// log_file and to process.stdout/stderr via .write() -- bypassing the real
// console.log/etc entirely. That broke `userserver-inspect-win.bat`/
// userserver-inspect-linux.sh (`node --inspect`/`--inspect-brk`): a
// debugger attached over the V8 Inspector protocol only sees console
// output via Runtime.consoleAPICalled events, which V8 emits from inside
// the real console.log/info/warn/error implementations -- calling
// stream.write() directly, even with identical text, never fires that
// event, so the debugger's console panel showed nothing. Capturing the
// real methods below and calling THROUGH to them (instead of past them)
// fixes that: the real console.log/etc still run -- inspector events and
// all -- and log_file.write() just tees a copy alongside.
const originalConsole = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console)
};

// SECURITY: every console line is passed through redact() (see redact.js)
// before it reaches console.log or the terminal, so the client's encrypted
// password and stored player password hashes/salts never get logged, no matter which call site produced the line. When nothing
// was redacted the original args are passed through untouched, so the
// inspector still gets real objects; when something was, it gets the
// redacted string instead.
function teeToLogFile(originalFn) {
    return (...args) => {
        const line = util.format(...args);
        const safeLine = redact(line);
        log_file.write(safeLine + '\n');
        if (safeLine === line) originalFn(...args);
        else originalFn(safeLine);
    };
}

console.log = teeToLogFile(originalConsole.log);
console.info = teeToLogFile(originalConsole.info);
console.warn = teeToLogFile(originalConsole.warn);
console.error = teeToLogFile(originalConsole.error);

global.MainConfig = null;
global.DBH = null;
global.databaseHandler = null;
// REFACTOR: business logic (account/player creation, login, removal,
// offline-gold-transfer orchestration -- see database/databaselogic.js)
// that used to live inside DatabaseHandler (redis.js) now lives here instead, exposed
// the same way DBH is: a global set up once at startup, referenced as a
// bare identifier elsewhere (user.js, worldhandler.js) per this codebase's
// existing convention for runtime-populated globals owned by main.js.
global.DBLogic = null;
global.worldHandlers = [];
global.users = new Map();

// Logging setup
//
// FIX: was `new Log(Log.INFO || Log.DEBUG || Log.ERROR)`, written against an
// older "log" package API (a Log class with static INFO/DEBUG/ERROR level
// constants and a constructor that takes one of them). The installed "log"
// dependency (see package.json) is a newer, unrelated package under the same
// name that exports a namespace-based logger factory with no INFO/DEBUG/ERROR
// statics at all -- so Log.INFO/Log.DEBUG/Log.ERROR were always undefined and
// the constructor argument did nothing (verified: `new Log(undefined)` and
// `new Log()` produce an identical empty instance). Simplified to `new Log()`
// since the argument was inert either way; setupLogging() below immediately
// overwrites .log/.info/.warn/.error on this instance with plain
// console.log/warn/error wrappers, which is what this codebase actually
// relies on for logging, not anything from the "log" package's own API.
global.log = new Log();

function setupLogging() {
    console.isEnabled = true;

    // Clear old methods
    Object.defineProperty(log, 'log', {
        value: undefined,
        writable: true,
        enumerable: true
    });
    Object.defineProperty(log, 'info', {
        value: undefined,
        writable: true,
        enumerable: true
    });
    Object.defineProperty(log, 'warn', {
        value: undefined,
        writable: true,
        enumerable: true
    });
    Object.defineProperty(log, 'error', {
        value: undefined,
        writable: true,
        enumerable: true
    });

    log.log = (d) => {
        const txt = `LOG: ${util.format(d)}\n`;
        console.info(txt);
    };

    log.info = (d) => {
        const txt = `INFO: ${util.format(d)}\n`;
        console.info(txt);
    };

    log.warn = (d) => {
        const txt = `WARN: ${util.format(d)}\n`;
        console.warn(txt);
    };

    log.error = (d) => {
        const txt = `ERROR: ${util.format(d)}\n`;
        console.error(txt);
    };
}

async function main(config) {
    const self = this;
    setupLogging();

    // Gates server.onConnect below -- flipped to true once the gold-field
    // migration that `new DatabaseHandlerClass(config)` kicks off (see
    // migrationReady in redis.js's constructor) resolves. The underlying
    // transport (WS.WebsocketServer's _protoServer.listen(), below) starts
    // accepting raw TCP/socket.io connections immediately on construction
    // regardless -- there's no clean hook to delay that without restructuring
    // ws.js -- so this flag is checked at the top of onConnect() instead: any
    // connection that arrives before migration finishes is closed immediately
    // rather than wired up to the game/login logic. Once true, this never
    // flips back.
    let migrationComplete = false;

    const production_config = new ProductionConfig(config);
    if (production_config.inProduction()) {
        Object.assign(config, production_config.getProductionSettings());
    }
    global.MainConfig = config;

    const server = new ws.WebsocketServer(config);

    // SECURITY: gameservers connect on their own listener instead of the
    // public one players use. It binds to the same address as the public
    // listener (config.ip), so access is meant to be restricted at the
    // firewall: allow "world_port" only from the gameserver's IP. The public
    // listener (config.ip:config.port) refuses gameserver traffic.
    //   world_port         (default config.port + 1)
    //   world_allowed_ips  array of gameserver IPs allowed to connect, e.g.
    //                      ["127.0.0.1"]; missing/empty = any address
    //                      (a warning is logged). A second layer behind the
    //                      firewall, not a replacement for it.
    //   world_protocol (default config.protocol; "https" reuses https_cert/key)
    const worldListenConfig = Object.assign({}, config, {
        protocol: config.world_protocol || config.protocol,
        port: config.world_port || Number(config.port) + 1,
        max_http_buffer_size: 16 * 1024 * 1024,
        allowed_ips: config.world_allowed_ips
    });
    const worldServer = new ws.WebsocketServer(worldListenConfig);
    if (
        Array.isArray(config.world_allowed_ips) &&
        config.world_allowed_ips.length > 0
    ) {
        console.info(
            'Gameserver listener allows: ' + config.world_allowed_ips.join(', ')
        );
    } else {
        console.warn(
            'WARNING: "world_allowed_ips" is not set -- any address can reach the ' +
                'gameserver listener on port ' + worldListenConfig.port +
                '. Restrict it in config.json and/or the firewall.'
        );
    }
    console.info(
        'Gameserver listener on ' + worldListenConfig.ip + ':' + worldListenConfig.port +
            ' (' + worldListenConfig.protocol + ')'
    );

    // A gameserver must send WU_GAMESERVER_INFO with the right password this
    // soon after connecting, or it is disconnected.
    const WORLD_AUTH_TIMEOUT_MS = 10 * 1000;
    const metrics = config.metrics_enabled ? new Metrics(config) : null;

    console.info('Initializing RRO2 GameServer - World');

    try {
        const selectorModule = await DatabaseSelector(config);
        const DatabaseHandlerClass = selectorModule.default || selectorModule;

        global.DBH = global.databaseHandler = new DatabaseHandlerClass(config);
        global.DBLogic = new DatabaseLogic(global.DBH);
        console.log('REDIS SERVER CREATED!!!!!!!!!!!!!');

        // migrateGoldFields() (redis.js) starts running the instant DBH is
        // constructed above -- await its migrationReady promise here so
        // nothing past this point (including migrationComplete below) runs
        // until every player's legacy "gold" field has been split into
        // gold_0/gold_1. Deliberately left inside this same try/catch --
        // same fail-fast posture as a failed DB connection: a migration that
        // can't finish means gold_0/gold_1 can't be trusted for every player,
        // and silently refusing every connection forever is worse than a
        // loud crash at startup.
        console.info(
            "Running startup gold-field migration (legacy 'gold' -> gold_0/gold_1)..."
        );
        await global.DBH.migrationReady;
        console.info(
            'Gold field migration complete -- now accepting connections.'
        );
    } catch (err) {
        console.error(
            'Database handler initialization / gold field migration failed:',
            err
        );
        process.exit(1);
    }

    migrationComplete = true;

    //const selector = DatabaseSelector(config);
    //selector(config);
    //DBH = databaseHandler = new selector(config);

    //console.log("REDIS SERVER CREATED!!!!!!!!!!!!!");

    const handleConnectWorld = (msg, conn) => {
        const wh = new WorldHandler(global, conn);
        conn._connection.worldHandler = wh;
        // FIX: the handler used to be pushed onto worldHandlers here, BEFORE
        // the gameserver had proved it knows user_password. Clients pick a
        // world by index into worldHandlers, so an unauthenticated (or
        // still-connecting) handler sitting ahead of the real one received
        // full player loads -- account data, bank, character, login token.
        // WorldHandler.handleGameServerInfo() now adds itself to the list
        // only after the password check passes.
        //
        // The gameserver link carries full player saves and the auction
        // list, so it gets a much larger decompression cap than a client.
        conn.maxInflateBytes = 64 * 1024 * 1024;

        setTimeout(() => {
            if (!wh.game_server) wh.rejectAuth('timeout');
        }, WORLD_AUTH_TIMEOUT_MS).unref();
        // Cleanup on disconnect is handled centrally by server.onDisconnect
        // below (it needs the full worldHandlers list to filter against).
    };

    const handleConnectUser = (msg, conn) => {
        // FIX: a connecting user used to always get a (possibly empty)
        // UC_WORLDS list and a fully wired-up User object, even when no
        // gameserver has ever registered (or the last one dropped) -- the
        // player would land on a login screen with nothing in the world
        // dropdown and no clear indication why. If no worldHandler has a
        // `.world` set (the same truthy check the UC_WORLDS loop below
        // already uses -- see handleGameServerInfo() in worldhandler.js,
        // which only assigns `.world` after a gameserver authenticates),
        // there's nothing this connection could ever do, so reject it
        // immediately with a dedicated UC_ERROR code instead of the normal
        // handshake, matching the existing send-error-then-close pattern
        // used for e.g. bans (see User.checkUser in user.js).
        const hasActiveWorld = worldHandlers.some((wh) => wh.world);
        if (!hasActiveWorld) {
            console.warn(
                'handleConnectUser: rejecting connection -- no gameserver is currently online.'
            );
            conn.send([GameTypes.UserMessages.UC_ERROR, 'noserver']);
            conn.close('No gameserver is currently online.');
            return;
        }

        // FIX: was sha1(Date.now() + Math.random()) -- predictable, and this
        // value is the key the client's password blob is encrypted with.
        // Same 40-hex-char format as before.
        const hash = crypto.randomBytes(20).toString('hex');

        conn.hash = hash;
        // FIX: no longer logged -- it's the key that decrypts this
        // connection's password -- and neither is `config` itself, which
        // was written to console.log on every connection including
        // user_password, redis_password, world_key and verify_key.
        console.info('version sent');
        console.info(`UC_VERSION: ${GameTypes.UserMessages.UC_VERSION}`);

        conn.sendUTF8(
            `1[${GameTypes.UserMessages.UC_VERSION},${config.version},"${conn.hash}"]`
        );

        const reply = [GameTypes.UserMessages.UC_WORLDS];
        let i = 0;
        for (const wh of worldHandlers) {
            const world = wh.world;
            if (!world) continue;

            reply.push(i++);
            reply.push(world.name);
            reply.push(world.count);
            reply.push(world.maxCount);
        }
        conn.send(reply);

        const user = new User(global, conn);
        user.hashChallenge = conn.hash;

        conn.onClose((conn) => {
            if (user?.hasLoggedIn) {
                users.delete(user.name);
            }

            // FIX: if this client disconnected while a player login was still
            // mid-load (requested a world via sendPlayerToWorld/
            // createPlayerToWorld but never got the WU_PLAYER_LOADED
            // confirmation back), that world's WorldHandler would otherwise keep
            // this player's pendingLogins/playerLoadData/playerCreateData
            // entries around forever -- see abandonPendingLogin() in
            // worldhandler.js. `user.worldHandler`/`user.playerName` are only
            // set once a load has actually started, so this is a no-op for
            // connections that never got that far.
            if (user?.worldHandler && user.playerName) {
                user.worldHandler.abandonPendingLogin(user.playerName);
            }
        });
    };

    server.onConnect((conn) => {
        // FIX: without this check, a connection arriving while
        // migrateGoldFields() is still running would get wired up to the full
        // login/gameplay flow against a player database that might not be
        // fully migrated yet -- exactly the race the blocking startup migration
        // above exists to avoid. Reject and close instead of listening.
        if (!migrationComplete) {
            console.warn(
                'onConnect: rejecting connection -- gold field migration still in progress.'
            );
            conn.close(
                'Server is still starting up, please try again shortly.'
            );
            return;
        }

        const listener = (message) => {
            if (config.debug) console.info(`recv[0]=${message}`);
            if (!Array.isArray(message)) return;
            const action = parseInt(message[0], 10);
            message.shift();

            switch (action) {
                case GameTypes.UserMessages.CU_CONNECT_USER:
                    handleConnectUser(message, conn);
                    break;
                case GameTypes.UserMessages.WU_CONNECT_WORLD:
                    // Gameservers use the internal listener (worldServer).
                    console.warn(
                        'Public listener: refused gameserver connection attempt -- gameservers must use world_port.'
                    );
                    conn.close('Gameservers must connect on world_port.');
                    break;
            }
        };
        conn.listen(listener);
    });

    worldServer.onConnect((conn) => {
        if (!migrationComplete) {
            console.warn(
                'worldServer onConnect: rejecting connection -- gold field migration still in progress.'
            );
            conn.close('Server is still starting up, please try again shortly.');
            return;
        }

        // The only thing a connection on this listener may do first is
        // announce itself as a gameserver; WorldHandler then takes over
        // the connection and requires the password (handleGameServerInfo).
        conn.maxInflateBytes = 64 * 1024 * 1024;
        conn.listen((message) => {
            if (config.debug) console.info(`world recv[0]=${message}`);
            const action = Array.isArray(message)
                ? parseInt(message[0], 10)
                : NaN;
            if (action !== GameTypes.UserMessages.WU_CONNECT_WORLD) {
                console.warn(
                    'worldServer: unexpected first message ' + action + ', closing.'
                );
                conn.close('Expected WU_CONNECT_WORLD.');
                return;
            }
            message.shift();
            handleConnectWorld(message, conn);
        });
    });

    const handleDisconnect = (socket) => {
        console.log('disconnected - client');

        const wh = socket._connection?.worldHandler;
        if (wh) {
            wh.release();
            worldHandlers = worldHandlers.filter((w) => w !== wh);
        }
    };
    server.onDisconnect(handleDisconnect);
    worldServer.onDisconnect(handleDisconnect);

    server.onError((...args) => {
        console.error(args.join(', '));
    });
    worldServer.onError((...args) => {
        console.error('worldServer: ' + args.join(', '));
    });

    server.onRequestStatus(() => {
        // `getWorldDistribution`/`worlds` were never defined anywhere in this
        // codebase, so this threw a ReferenceError the moment anything invoked
        // the status callback. Build the distribution from the live
        // worldHandlers list instead, the same data used in handleConnectUser.
        const distribution = worldHandlers
            .filter((wh) => wh.world)
            .map((wh) => ({
                name: wh.world.name,
                count: wh.world.count,
                maxCount: wh.world.maxCount
            }));
        return JSON.stringify(distribution);
    });

    process.on('uncaughtException', (e) => {
        console.info(JSON.stringify(e));
        console.error('uncaughtException: ' + e.stack);
    });

    // Socket.io events
    server._ioServer.on('connection', () => {
        console.log('connected');
    });

    server._ioServer.on('msg', (message) => {
        console.log('msg=' + JSON.stringify(message));
    });

    const signalHandler = () => closeServer();

    process.on('SIGINT', signalHandler);
    process.on('SIGTERM', signalHandler);
    process.on('SIGQUIT', signalHandler);

    cmdPrompt();
}

function changePassword(args) {
    // const world = worlds[0]; // `worlds` appears unused / undefined in provided code
    const username = args[0];
    const password = args[1];

    // FIX: this originally computed sha1(username + password) and saved only
    // `hash` -- a completely different formula than what checkUser() (user.js)
    // verifies logins against, permanently locking out any account this ran
    // against. That was first fixed by matching checkUser()'s legacy
    // sha1(password + salt) formula; now that accounts are hashed with bcrypt
    // (see BCRYPT_SALT_ROUNDS in user.js), this admin reset does the same, so
    // a reset account ends up in the same, stronger format as a freshly
    // created or already-upgraded one instead of dropping back to the legacy
    // scheme. bcrypt embeds its own salt, so the separate `salt` field is left
    // blank here too, same as user.js's handleCreateUser.
    bcrypt.hash(password, 10, (err, hash) => {
        if (err) {
            console.error(
                'changePassword - bcrypt.hash failed: ' + err.message
            );
            return;
        }
        DBLogic.savePassword(username, hash, '');
    });
}

// One-time, admin-triggered console command -- run this manually if/when
// there turn out to be accounts left over from before "looks_b64" existed,
// still holding a plain u:<username> "looks" field (a format nothing in
// this codebase understands any more) and/or a "looks2" field that somehow
// didn't get picked up by the automatic migrateLooksToBase64() startup
// migration. See migration.js's resetLegacyLooksToDefault() for the full
// rationale: rather than try to decode either legacy field, it just seeds
// affected accounts with the same beginner-default appearance a brand-new
// account gets and deletes both stale fields wherever it finds them,
// landing every account it touches on "looks_b64" like everyone else. Safe
// to run more than once (an account with neither legacy field left is
// skipped), but there's no reason to -- it's expected to only ever need
// running once, hence no automatic wiring into migrationReady (redis.js)
// the way the real "looks2" -> "looks_b64" migration has.
function fixLegacyLooks() {
    if (!global.DBH) {
        console.error('fixlegacylooks: database not ready yet.');
        return;
    }
    console.info('fixlegacylooks: starting...');
    global.DBH.resetLegacyLooksToDefault((err) => {
        if (err) {
            console.error(
                'fixlegacylooks: finished with errors -- see log above.'
            );
            return;
        }
        console.info('fixlegacylooks: done -- see log above for how many accounts were reset.');
    });
}

// One-off, admin-triggered console command -- unconditionally clears every
// player's in-progress quest list ('newquests'/'newquests2'), every single
// time it's run. Unlike fixLegacyLooks() above (which repairs stragglers
// left over from one specific historical migration and is safe to leave
// running repeatedly since it's a no-op once an account is clean), this has
// no "already handled" flag and no notion of stale-vs-current data -- it
// wipes whatever's currently saved, full stop. Run it deliberately, e.g.
// right after a quest-content change that would otherwise leave players
// stuck holding quest progress that no longer lines up with the new
// quest/NPC data. See migration.js's wipeAllNewQuests() for the full
// rationale.
function wipeNewQuests() {
    if (!global.DBH) {
        console.error('wipenewquests: database not ready yet.');
        return;
    }
    console.info('wipenewquests: starting...');
    global.DBH.wipeAllNewQuests((err) => {
        if (err) {
            console.error(
                'wipenewquests: finished with errors -- see log above.'
            );
            return;
        }
        console.info(
            'wipenewquests: done -- see log above for how many players were wiped.'
        );
    });
}

function getInput(cmd) {
    const args = cmd.split(' ');
    const cmdarg = args[0];
    args.shift();

    console.info('cmd: ' + cmd);

    switch (cmdarg) {
        case 'setpass':
            changePassword(args);
            break;
        case 'fixlegacylooks':
            fixLegacyLooks();
            break;
        case 'wipenewquests':
            wipeNewQuests();
            break;
        case 'replay': {
            // reject.log has a ready `replay <packet>` line for every
            // rejected packet (see rejectlog.js) -- copy that whole line,
            // edit/fix the packet's JSON if that's what was wrong with it,
            // and paste it right here. It runs exactly as if a connected
            // gameserver had sent it, even though it's coming from this
            // command line. formatChecker.check() still applies -- this
            // doesn't skip validation, only the "is a gameserver actually
            // connected" gate. See replay.js.
            const m = cmd.match(/^replay\s+([\s\S]+)$/);
            if (!m) {
                console.info('usage: replay <packet text -- see reject.log for ready-to-paste lines>');
            } else {
                replayPacket(m[1]);
            }
            break;
        }
        case 'exit':
        case 'quit':
        case 'q':
        case 'x':
            closeServer();
            break;
        // FIX: 's'/'save' used to fall through to closeServer() above, so
        // typing "save" shut the whole server down.
        case 's':
        case 'save':
            saveServer();
            break;
        case 'forcequit':
            closeServer();
            process.exit(1);
            break;
        default:
            console.info('Unknown command.');
    }
}

// FIX: checkSaved() waited forever for every world to report fully saved --
// a single failed Redis write (whose callback never fires) or a player load
// that never completed kept the counters from ever finishing, and shutdown
// hung. Give up and exit after this long.
const SAVE_TIMEOUT_MS = 60 * 1000;

function checkSaved() {
    const deadline = Date.now() + SAVE_TIMEOUT_MS;
    const allSavedInterval = setInterval(() => {
        console.info('allSavedInterval');

        const allSaved = worldHandlers.every((wh) => wh.savedWorldState());
        const timedOut = Date.now() > deadline;
        if (timedOut && !allSaved) {
            console.error(
                'checkSaved: timed out after ' + SAVE_TIMEOUT_MS / 1000 +
                    's waiting for saves to finish -- exiting anyway.'
            );
        }

        if (allSaved || timedOut) {
            for (const wh of worldHandlers) {
                wh.sendWorldClose();
            }
            clearInterval(allSavedInterval);
            setTimeout(() => process.exit(0), 2000);
        }
    }, 500);
}

function closeServer() {
    readline.close();
    saveServer();
    checkSaved();
}

function saveServer() {
    console.log('saving server!');
    for (const wh of worldHandlers) {
        wh.sendWorldSave();
    }
}

function getConfigFile(path) {
    return new Promise((resolve, reject) => {
        fs.readFile(path, 'utf8', (err, json_string) => {
            if (err) {
                resolve(null);
            } else {
                try {
                    resolve(JSON.parse(json_string));
                } catch (e) {
                    reject(e);
                }
            }
        });
    });
}

// --- Entry point ---
const defaultConfigPath = './config.json';
let customConfigPath = './config_local.json';

if (process.argv[2]) {
    customConfigPath = process.argv[2];
}

(async () => {
    try {
        const defaultConfig = await getConfigFile(defaultConfigPath);
        const localConfig = await getConfigFile(customConfigPath);

        if (localConfig) {
            main(localConfig);
        } else if (defaultConfig) {
            main(defaultConfig);
        } else {
            console.error(
                'Server cannot start without any configuration file.'
            );
            process.exit(1);
        }
    } catch (err) {
        console.error('Config loading error:', err);
        process.exit(1);
    }
})();

// Helper (if needed)
const cmdPrompt = () => {
    readline.question('Command: ', (line) => {
        getInput(line);
        setTimeout(cmdPrompt, 100);
    });
};

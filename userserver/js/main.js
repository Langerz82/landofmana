import * as common from './common.js';

import fs from 'fs';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import Metrics from './metrics.js';
import ProductionConfig from './productionconfig.js';
import User from './user.js';
import WorldHandler from './worldhandler.js';
//import Utils from './utils.js';
import redis from './redis.js';
import AccountLogic from './accountlogic.js';
import UserMessages from './usermessage.js';

// Add these:
import ws from './ws.js';
import DatabaseSelector from './databaseselector.js';

//import _ from 'underscore';
import { createInterface } from 'readline';

import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const readline = createInterface({
  input: process.stdin,
  output: process.stdout
});

const packageName = "com.retrorpgonline2";

const IO_STATES = {
  MSG_BUYPRODUCT: 1,
  MSG_ERRORPRODUCT: 2,
};

let SAVING_SERVER = false;
let AUCTION_SAVED = false;
let PLAYERS_SAVED = false;

// Global setup
import Log from 'log';
import util from 'util';

const log_file = fs.createWriteStream(__dirname + '/../console.log', { flags: 'w' });
const log_stdout = process.stdout;

global.MainConfig = null;
global.DBH = null;
global.databaseHandler = null;
// REFACTOR: business logic (account/player creation, login, removal,
// offline-gold-transfer orchestration -- see accountlogic.js) that used to
// live inside DatabaseHandler (redis.js) now lives here instead, exposed
// the same way DBH is: a global set up once at startup, referenced as a
// bare identifier elsewhere (user.js, worldhandler.js) per this codebase's
// existing convention for runtime-populated globals owned by main.js.
global.Accounts = null;
global.worldHandlers = [];
global.users = new Map();

// Logging setup
global.log = new Log(Log.INFO || Log.DEBUG || Log.ERROR);

function setupLogging() {
  console.isEnabled = true;

  // Clear old methods
  Object.defineProperty(log, "log", { value: undefined, writable: true, enumerable: true });
  Object.defineProperty(log, "info", { value: undefined, writable: true, enumerable: true });
  Object.defineProperty(log, "warn", { value: undefined, writable: true, enumerable: true });
  Object.defineProperty(log, "error", { value: undefined, writable: true, enumerable: true });

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
  const metrics = config.metrics_enabled ? new Metrics(config) : null;

  console.info("Initializing RRO2 GameServer - World");

  try {
      const selectorModule = await DatabaseSelector(config);
      const DatabaseHandlerClass = selectorModule.default || selectorModule;

      global.DBH = global.databaseHandler = new DatabaseHandlerClass(config);
      global.Accounts = new AccountLogic(global.DBH);
      console.log("REDIS SERVER CREATED!!!!!!!!!!!!!");

      // migrateGoldFields() (redis.js) starts running the instant DBH is
      // constructed above -- await its migrationReady promise here so
      // nothing past this point (including migrationComplete below) runs
      // until every player's legacy "gold" field has been split into
      // gold_0/gold_1. Deliberately left inside this same try/catch --
      // same fail-fast posture as a failed DB connection: a migration that
      // can't finish means gold_0/gold_1 can't be trusted for every player,
      // and silently refusing every connection forever is worse than a
      // loud crash at startup.
      console.info("Running startup gold-field migration (legacy 'gold' -> gold_0/gold_1)...");
      await global.DBH.migrationReady;
      console.info("Gold field migration complete -- now accepting connections.");
  } catch (err) {
      console.error("Database handler initialization / gold field migration failed:", err);
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
    worldHandlers.push(wh);
    // Cleanup on disconnect is handled centrally by server.onDisconnect
    // below (it needs the full worldHandlers list to filter against).
  };

  const handleConnectUser = (msg, conn) => {
    const current_date = Date.now().toString();
    const random = Math.random().toString();
    const hash = crypto.createHash('sha1').update(current_date + random).digest('hex');

    conn.hash = hash;
    console.warn(`onConnect: hash=${hash}`);

    console.info(JSON.stringify(config));
    console.info("version sent");
    console.info(`UC_VERSION: ${GameTypes.UserMessages.UC_VERSION}`);

    conn.sendUTF8(`1[${GameTypes.UserMessages.UC_VERSION},${config.version},"${conn.hash}"]`);

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
      console.warn("onConnect: rejecting connection -- gold field migration still in progress.");
      conn.close("Server is still starting up, please try again shortly.");
      return;
    }

    const listener = (message) => {
      console.info(`recv[0]=${message}`);
      const action = parseInt(message[0], 10);
      message.shift();

      switch (action) {
        case GameTypes.UserMessages.WU_CONNECT_WORLD:
          handleConnectWorld(message, conn);
          break;
        case GameTypes.UserMessages.CU_CONNECT_USER:
          handleConnectUser(message, conn);
          break;
      }
    };
    conn.listen(listener);
  });

  server.onDisconnect((socket) => {
    console.log('disconnected - client');

    const wh = socket._connection?.worldHandler;
    if (wh) {
      wh.release();
      worldHandlers = worldHandlers.filter(w => w !== wh);
    }
  });

  server.onError((...args) => {
    console.error(args.join(", "));
  });

  server.onRequestStatus(() => {
    // `getWorldDistribution`/`worlds` were never defined anywhere in this
    // codebase, so this threw a ReferenceError the moment anything invoked
    // the status callback. Build the distribution from the live
    // worldHandlers list instead, the same data used in handleConnectUser.
    const distribution = worldHandlers
      .filter((wh) => wh.world)
      .map((wh) => ({ name: wh.world.name, count: wh.world.count, maxCount: wh.world.maxCount }));
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
    console.log("msg=" + JSON.stringify(message));
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
      console.error("changePassword - bcrypt.hash failed: " + err.message);
      return;
    }
    DBH.savePassword(username, hash, "");
  });
}

function getInput(cmd) {
  const args = cmd.split(" ");
  const cmdarg = args[0];
  args.shift();

  console.info("cmd: " + cmd);

  switch (cmdarg) {
    case "setpass":
      changePassword(args);
      break;
    case "exit":
    case "quit":
    case "q":
    case "x":
    case "s":
    case "save":
      closeServer();
      break;
    case "forcequit":
      closeServer();
      process.exit(1);
      break;
    default:
      console.info("Unknown command.");
  }
}

function checkSaved() {
  const allSavedInterval = setInterval(() => {
    console.info("allSavedInterval");

    const allSaved = worldHandlers.every(wh => wh.savedWorldState());

    if (allSaved) {
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
  console.log("saving server!");
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
      console.error("Server cannot start without any configuration file.");
      process.exit(1);
    }
  } catch (err) {
    console.error("Config loading error:", err);
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

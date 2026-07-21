/* global log, DBH, MainConfig */
import UserMessages from './usermessage.js';
import { Types } from '../common.js';
import Player from '../entity/player/player.js';
import Utils from '../utils.js';
import AppearanceData from '../data/appearancedata.js';
import Quest, { getQuestObject } from '../quest.js';
import QuestData from '../data/questdata.js';
import ItemRoom from '../items/itemroom.js';
import Inventory from '../items/inventory.js';
import Bank from '../items/bank.js';
import Equipment from '../items/equipment.js';
import { hashes } from '../main.js';
import { getInitAchievements, getSavedAchievement } from '../world/taskhandler.js';

// FIX: unlike the client-facing (CW_*) channel, which validates every packet
// against a strict Zod schema before dispatch (see format.js and
// worldhandler.js's connection.listen), messages arriving here from the
// userserver process were dispatched with no shape validation at all --
// every handler below indexes straight into `message`/`data` assuming
// specific array lengths and nesting (most sharply handleLoadPlayerData,
// which reads `data[0][1]` and hands `data[1..6]` to six other handlers
// that each assume their own shape). This is lower severity than the
// client-facing gap since the userserver is an operator-controlled process,
// not an untrusted client, but a malformed/corrupted payload (a userserver
// bug, a bad Redis record, a version mismatch between the two processes
// after a partial deploy) still threw deep inside a handler instead of
// failing cleanly at the door. This isn't a full Zod schema like format.js
// -- this channel's save-data shapes are deeply nested and specific enough
// that reimplementing them field-by-field isn't worth it for an
// operator-controlled link -- but it catches the common failure mode
// (wrong length, wrong type, missing nested array) for the handler that
// actually dereferences nested structure before any of its own handlers run.
function isValidUserMessage(action, message) {
    switch (action) {
    case Types.UserMessages.UW_LOAD_PLAYER_DATA:
        // [playerName, [userInfo, info, quests, achievements, inv, bank, equip]]
        // -- userInfo itself is read as data[0][1] (hash) before
        // handleLoadUserInfo() even runs, so it needs its own shape check.
        return Array.isArray(message) && message.length === 2 &&
            typeof message[0] === "string" &&
            Array.isArray(message[1]) && message[1].length === 7 &&
            Array.isArray(message[1][0]) && message[1][0].length >= 4;
    case Types.UserMessages.UW_LOAD_PLAYER_AUCTIONS:
    case Types.UserMessages.UW_LOAD_PLAYER_LOOKS:
    case Types.UserMessages.UW_LOAD_USER_BANS:
        return Array.isArray(message);
    case Types.UserMessages.UW_WORLD_SAVE:
    case Types.UserMessages.UW_WORLD_CLOSE:
        return true; // no payload fields are read for either.
    default:
        return true; // unknown actions fall through untouched, same as before.
    }
}

class UserHandler {
    constructor(main, server, world, connection) {
        const self = this;

        this.main = main;
        this.server = server;
        this.world = world;
        this.connection = connection;
        this.userHandlerPackets = [];

        this.connection.listen(function(message) {
            console.info("recv="+JSON.stringify(message));
            const action = parseInt(message[0]);
            message.shift();

            if (!isValidUserMessage(action, message)) {
                console.warn("userHandler: rejected malformed message for action "+action+": "+JSON.stringify(message));
                return;
            }

            switch (action) {
            case Types.UserMessages.UW_LOAD_PLAYER_DATA:
                self.handleLoadPlayerData(message);
                return;
            case Types.UserMessages.UW_LOAD_PLAYER_AUCTIONS:
                self.handleLoadPlayerAuctions(message);
                return;
            case Types.UserMessages.UW_LOAD_PLAYER_LOOKS:
                self.handleLoadPlayerLooks(message);
                return;
            case Types.UserMessages.UW_LOAD_USER_BANS:
                self.handleLoadUserBans(message);
                return;
            case Types.UserMessages.UW_WORLD_SAVE:
                self.handleWorldSave(message);
                return;
            case Types.UserMessages.UW_WORLD_CLOSE:
                self.handleWorldClose(message);
                return;
            }

        });

        this.sendOldPackets();
    }

    sendOldPackets() {
        for (const msg of this.userHandlerPackets)
        {
            this.connection.send(msg.serialize());
        }
        this.userHandlerPackets = [];
    }

    onExit() {
    }

    send(message) {
        this.connection.send(message);
    }

    handleWorldSave(msg) {
        console.info("handleWorldSave.");
        //this.world.save();
        this.main.saveServer();
    }

    handleWorldClose(msg) {
        console.info("handleWorldClose.");
        this.main.safe_exit();
    }

    handleLoadPlayerAuctions(msg) {
        console.info("handleLoadPlayerAuctions: "+JSON.stringify(msg));

        if (!msg)
            return;

        this.world.auction.load(msg);
    }

    handleLoadPlayerLooks(msg) {
        console.info("handleLoadPlayerLooks: "+JSON.stringify(msg));

        if (!msg)
            return;

        this.world.looks.load(msg);
    }

    handleLoadUserBans(msg) {
        console.info("handleLoadUserBans: "+JSON.stringify(msg));

        if (!msg)
            return;

        if (this.world.ban)
            this.world.ban.loadBans(msg);
        else {
            console.warn("world ban not loaded.");
        }
    }

    handleLoadPlayerData(msg) {
        console.info("userHandler, handleLoadPlayerData.");

        const playerName = msg[0];
        const data = msg[1];
        const username = data[0][1];

        if (this.world.ban.isUserBanned(username)) {
            console.info("USER IS BANNED.");
            return;
        }

        console.info("handleLoadPlayerData data: "+JSON.stringify(data));
        this.handleLoadUserInfo(playerName, data[0]);
        this.handleLoadPlayerInfo(data[1]);
        this.handleLoadPlayerQuests(data[2]);
        this.handleLoadPlayerAchievements(data[3]);
        this.handleLoadPlayerItems(0, data[4]);
        this.handleLoadPlayerItems(1, data[5]);
        this.handleLoadPlayerItems(2, data[6]);

        const player = this.player;
        console.info("player hash: "+player.hash);
        // FIX: was `hashes[player.hash] = player` -- a plain bracket
        // property assignment on a Map instance instead of hashes.set().
        // The property write "worked" (Map is still a regular object you
        // can bolt properties onto) but nothing downstream could ever
        // remove it that way -- worldhandler.js's consuming side read it
        // back with hasOwnProperty()/bracket access too (see the matching
        // fix there), and neither side ever called hashes.delete(), so
        // every single login permanently leaked one entry into `hashes`
        // for the life of the process. Using the real Map API here (paired
        // with the .delete() added in worldhandler.js's handleLoginPlayer)
        // lets the one-time login hash actually get cleaned up once it's
        // been consumed.
        hashes.set(player.hash, player);
        this.player = null;
        // FIX: this used to omit playerName, so the userserver's
        // WorldHandler.handlePlayerLoaded (userserver/js/worldhandler.js)
        // had no way to know which pending login this response belonged
        // to -- it fell back to a shared `this.user` field that a second,
        // concurrent login could already have overwritten, routing the
        // "world ready" reply to the wrong client. Including playerName
        // lets that handler look up the correct pending login instead.
        this.send([Types.UserMessages.WU_PLAYER_LOADED, playerName,
            MainConfig.protocol,MainConfig.address,MainConfig.port]);
    }

    // NOTE: `player` was a bare (undeclared) assignment in the original CommonJS
    // source, which created an implicit global there; declared with `var` here
    // since ES modules are always strict mode and forbid implicit globals.
    handleLoadUserInfo(playerName, msg) {
        console.info("handleLoadUserInfo: "+JSON.stringify(msg));

        const username = msg[0],
            hash = msg[1],
            gems = parseInt(msg[2]),
            looks = msg[3];

        const conn = this.connection;
        const user = {};
        user.hashChallenge = conn.hash;
        user.world = this.world;
        user.conn = conn;
        user.userHandler = this;

        this.server.enterWorld(conn);

        user.gems = gems;
        const len = AppearanceData.Data.length;
        user.looks = Utils.Base64ToBinArray(looks, len);
        user.name = username;

        const player = new Player(this.world, user, conn);
        this.world.playerCallback.setCallbacks(player);

        player.name = playerName;
        player.hash = hash;
        player.loaded = 0;
        // NOTE: was `player.worldHandler = user.worldHandler;` -- `user`
        // (built just above) never has a `.worldHandler` property set on
        // it anywhere (only `.userHandler`), so this always assigned
        // `undefined`. Nothing ever reads `player.worldHandler` either --
        // the real save path is `player.connection.worldHandler`
        // (entity/player.js's save(), populated by `conn.worldHandler = wh`
        // in main.js), a completely separate field. Removed as dead code
        // rather than "fixed", since there's nothing for it to actually do.
        this.player = player;

        this.loadedPlayer = true;
    }

    handleLoadPlayerInfo(msg) {
        console.info("handleLoadPlayerInfo: "+JSON.stringify(msg));
        const player = this.player;
        //console.info(msg.toString());
        const data_player = {
            "name": msg[0],
            "map": msg[1].split(","),
            "stats": msg[2].split(","),
            "exps": msg[3].split(","),
            // REFACTOR: userserver now sends gold_0/gold_1 as two flat
            // elements (msg[4], msg[5]) instead of a CSV string or a nested
            // [gold0, gold1] array -- see the REFACTOR comment on
            // AccountLogic.loadPlayerInfo()/savePlayerInfo()
            // (userserver/js/accountlogic.js) for the full trail. Wrapped
            // into a small array here purely for fillPlayerInfo()'s
            // convenience (player.js reads db_player.gold[0]/[1]); nothing
            // left to split. Every field below is shifted one index later
            // than before to make room for the extra top-level element.
            "gold": [msg[4], msg[5]],
            "skills": msg[6].split(","),
            "pStats": msg[7].split(","),
            "sprites": msg[8].split(","),
            "colors": msg[9].split(","),
            "shortcuts": msg[10],
            "completeQuests": msg[11]
        };

        console.info("shortcuts: "+JSON.stringify(data_player.shortcuts));
        console.info("completeQuests: "+JSON.stringify(data_player.completeQuests));

        if (data_player.shortcuts) {
            data_player.shortcuts = JSON.parse(data_player.shortcuts);
        }

        if (data_player.completeQuests) {
            data_player.completeQuests = JSON.parse(data_player.completeQuests);
        }

        player.fillPlayerInfo(data_player);
    }

    // NOTE: `dataJSON` was a bare (undeclared) assignment in the original
    // CommonJS source, which created an implicit global there; declared with
    // `var` here since ES modules are always strict mode and forbid implicit
    // globals.
    //
    // NOTE: `msg` here looks like it should be the raw JS array
    // loadPlayerDataQuests() built on the save side (worldhandler.js:
    // `quests.push(quest.toArray().join(','))`), which would make this
    // JSON.parse(msg) look wrong -- but it's correct. Confirmed by reading
    // userserver/js/worldhandler.js's handleSavePlayerData(), which does
    // `DBH.saveQuests(playerName, JSON.stringify(data[2]), ...)` before
    // persisting to Redis, and userserver/js/redis.js's loadQuests() returns
    // that same JSON string back verbatim via `hget`. So by the time this
    // handler sees `msg`, it really is a JSON-encoded string (an array of
    // comma-joined quest-field strings), and JSON.parse + the per-record
    // .split(',') below is the correct way to unpack it.
    handleLoadPlayerQuests(msg) {
        console.info("handleLoadPlayerQuests: "+JSON.stringify(msg));
        const player = this.player;

        console.info("msg="+msg);
        try {
            const dataJSON = JSON.parse(msg);
            for (let i = 0; i < dataJSON.length; i++) {
                const questData = dataJSON[i].split(',');
                if (questData) {
                    console.info(JSON.stringify(questData));
                    const quest = new Quest(questData.splice(0,7));
                    if (questData.length > 0)
                        quest.object = getQuestObject(questData.splice(0,6));
                    if (questData.length > 0)
                        quest.object2 = getQuestObject(questData.splice(0,6));
                    quest.data = QuestData.Data.hasOwnProperty(quest.id) ? QuestData.Data[quest.id] : null;
                    player.quests.quests.push(quest);
                }
            }
        }
        catch (err) {
            console.warn(err.stack);
        }
    }

    handleLoadPlayerAchievements(msg) {
        console.info("handleLoadPlayerAchievements: "+JSON.stringify(msg));
        const player = this.player;

        const achievements = getInitAchievements();
        const rec = msg.split(',');
        const len = ~~(rec.length / 3);
        for (let i=0; i < len; ++i)
        {
            const achievement = getSavedAchievement(rec.splice(0,3));
            player.achievements.push(achievement);
        }
        for (let i=len; i < achievements.length; ++i)
        {
            player.achievements.push(achievements[i]);
        }
    }

    // NOTE: `dataJSON` was a bare (undeclared) assignment in the original
    // CommonJS source, which created an implicit global there; declared with
    // `var` here since ES modules are always strict mode and forbid implicit
    // globals.
    handleLoadPlayerItems(type, msg) {
        console.info("handleLoadPlayerItems: "+JSON.stringify(msg));
        const player = this.player;
        const items = [];

        console.info("getItems - data="+msg);
        // FIX: this JSON.parse(msg) used to run unguarded, unlike the
        // near-identical handleLoadPlayerQuests() above (which wraps the
        // same parse-then-loop shape in try/catch and logs a warning on
        // failure). A malformed/corrupted item payload from the userserver
        // threw synchronously here, inside the connection's message
        // handler -- caught only by main.js's process-wide
        // uncaughtException handler, leaving the player session half
        // loaded with no clean recovery path. Matching the quests handler's
        // pattern: on failure, log and fall back to an empty item list
        // (items stays []) so the inventory/bank/equipment store below is
        // still constructed, just empty, instead of crashing.
        try {
            const dataJSON = JSON.parse(msg);
            for (const itemData of dataJSON) {
                if (itemData) {
                    const item = new ItemRoom([
                        parseInt(itemData[1]),
                        parseInt(itemData[2]),
                        parseInt(itemData[3]),
                        parseInt(itemData[4]),
                        parseInt(itemData[5])]);
                    item.slot = parseInt(itemData[0]);
                    items.push(item);
                }
            }
        }
        catch (err) {
            console.warn(err.stack);
        }
        let storeType = null;
        if (type === 0){
            player.items.inventory = new Inventory(player, 50, items);
            storeType = player.items.inventory;
        }
        else if (type === 1){
            player.items.bank = new Bank(player, 96, items);
            storeType = player.items.bank;
        }
        else if (type === 2){
            player.items.equipment = new Equipment(player, 5, items);
            storeType = player.items.equipment;
            player.items.equipment.setItem = function (index, item) {
                const res = player.items.equipment._setItem(index, item);
                player.setRange();
                return res;
            };
        }
        player.items.itemStore[type] = storeType;
    }

    sendToUserServer(msg) {
        if (this.connection)
            this.connection.send(msg.serialize());
        else {
            this.userHandlerPackets.push(msg);
            console.info("userHandler: sendToUserServer called without connection being set: "+JSON.stringify(msg.serialize()));
        }
    }

    sendWorldInfo(config) {
        const msg = new UserMessages.ServerInfo(config, 0);
        this.sendToUserServer(msg);
    }

    sendWorldPlayerCount(count, maxCount) {
        this.sendToUserServer( new UserMessages.UpdatePlayerCount(count, maxCount));
    }

    sendAuctionsData(data) {
        this.sendToUserServer( new UserMessages.SavePlayerAuctions(data));
    }

    sendLooksData(data) {
        this.sendToUserServer( new UserMessages.SavePlayerLooks(data));
    }

    sendBansData(data) {
        this.sendToUserServer( new UserMessages.SaveUserBans(data));
    }

    sendPlayerGold(name, gold) {
        this.sendToUserServer( new UserMessages.SendPlayerGold(name, gold));
    }

    sendPlayerLogout(player) {
        this.sendToUserServer(new UserMessages.playerLoggedIn(0,player.user.name, player.name));
    }

    sendPlayersList(data) {
        console.info("userHandler - sendPlayersList: "+JSON.stringify(data));
        this.sendToUserServer( new UserMessages.SavePlayersList(data));
    }
}

export default UserHandler;

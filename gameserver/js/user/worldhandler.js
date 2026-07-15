/* global log, DBH  _ */
import { check as formatCheck } from '../format.js';
import UserMessages from './usermessage.js';
import Messages from '../message.js';
import { Types } from '../common.js';
import Utils from '../utils.js';
import { hashes, players } from '../main.js';

class WorldHandler {
    constructor(main, connection) {
        const self = this;

        this.main = main;
        this.connection = connection;
        //this.userHandler = userHandler;

        this.playerSaveData = {};

        this.connection.listen(function(message) {
            console.info("recv="+JSON.stringify(message));
            const action = parseInt(message[0]);

            if (action)
                if(!formatCheck(message)) {
                    self.connection.close("Invalid "+Types.getMessageTypeAsString(action)+" message format: "+message);
                    return;
                }
            message.shift();

            if (action === Types.Messages.CW_LOGIN_PLAYER) {
                self.handleLoginPlayer(message);
                return;
            }

        });
    }

    onExit() {
    }

    sendPlayer(message) {
        this.connection.send(message);
    }

    sendPlayerMessage(msg) {
        this.connection.send(msg.serialize());
    }

    handleLoginPlayer(msg) {
        console.info("worldHandler, handleLoginPlayer: "+JSON.stringify(msg));
        const playerName = msg[0],
            playerHash = msg[1];

        let player = null;
        if (hashes.hasOwnProperty(playerHash))
            player = hashes[playerHash];

        if (!player) {
            console.info("player hash does not exist.");
            this.connection.disconnect();
            return;
        }

        const username = player.user.name;
        if (players.has(username)) {
            console.info("player user is already logged in.");
            this.sendPlayerMessage(new Messages.Error("user already logged in."));
            this.connection.disconnect();
            return;
        }

        // FIX: `players.set(username, player)` used to run here, before the
        // ban/world checks below. Both of those checks' early-return
        // branches (banned user, or world/world.ban not set) call
        // this.connection.disconnect() -- which only closes the socket
        // (ws.js), it does NOT remove the entry from `players` -- that only
        // happens via the packetHandler.onExit cleanup wired up inside
        // player.start(), which those branches return before reaching. So a
        // banned (or misconfigured-world) login attempt left a permanent
        // entry in `players`, and the `players.has(username)` check above
        // would then reject every future login attempt for that username,
        // forever, even after an unban -- until the process restarted.
        // Moving the `players.set()` to after both checks means it only
        // happens once we're actually committed to letting the player in.
        if (player.world && player.world.ban) {
            if (player.world.ban.isUserBanned(username)) {
                console.info("player user is banned from server.");
                this.sendPlayerMessage(new Messages.Error("user is banned."));
                this.connection.disconnect();
                return;
            }
        } else {
            console.warn("handleLoginPlayer: world or world ban not set");
            return;
        }

        players.set(username, player);

        player.start(this.connection);

        this.sendToUserServer(new UserMessages.playerLoggedIn(1,player.user.name, playerName));
    }

    loadPlayerDataUserInfo(player, callback) {
        const user = player.user;
        const data = [
            user.name,
            user.hash,
            Number(user.gems),
            Utils.BinArrayToBase64(user.looks)];

        if (callback)
            callback(user.name, data);
    }

    loadPlayerDataInfo(player, callback) {
        const stats = [
            player.stats.attack,
            player.stats.defense,
            player.stats.health,
            player.stats.energy,
            player.stats.luck,
            player.stats.free];

        const exps = [
            Utils.NaN2Zero(player.stats.exp.base),
            Utils.NaN2Zero(player.stats.exp.attack),
            Utils.NaN2Zero(player.stats.exp.defense),
            Utils.NaN2Zero(player.stats.exp.move),
            Utils.NaN2Zero(player.stats.exp.sword),
            Utils.NaN2Zero(player.stats.exp.bow),
            Utils.NaN2Zero(player.stats.exp.hammer),
            Utils.NaN2Zero(player.stats.exp.axe),
            Utils.NaN2Zero(player.stats.exp.logging),
            Utils.NaN2Zero(player.stats.exp.mining),
        ];

        const map = [
            player.map.index,
            player.x,
            player.y,
            player.orientation];

        const skillexps = [];
        for (let i =0 ; i < player.skills.length; ++i)
            skillexps[i] = player.skills[i].skillXP;

        //var completeQuests = (Object.keys(player.completeQuests).length > 0) ? JSON.stringify(player.completeQuests) : 0;

        const hexLooks = Utils.BinArrayToBase64(player.user.looks);

        const data = [
            player.name,
            map.join(","),
            stats.join(","),
            exps.join(","),
            player.items.gold.join(","),
            skillexps.join(","),
            player.pStats.join(","),
            player.sprites.join(","),
            player.colors.join(","),
            JSON.stringify(player.shortcuts),
            JSON.stringify(player.quests.completeQuests)];

        if (callback)
            callback(player.name, data);
    }

    // NOTE: this sends `quests` as a real JS array of comma-joined strings,
    // while userhandler.js's handleLoadPlayerQuests (load side) does
    // JSON.parse(msg) on the way back in -- looks mismatched in isolation,
    // but it isn't: userserver/js/worldhandler.js's handleSavePlayerData
    // explicitly does `JSON.stringify(data[2])` before persisting this array
    // to Redis, and hands the same JSON string back unchanged on load. So
    // the array shape here is exactly what the userserver expects to
    // JSON.stringify, and JSON.parse on the other end is the correct inverse
    // of that -- confirmed by reading through userserver's worldhandler.js
    // and redis.js.
    loadPlayerDataQuests(player, callback) {
        const quests = [];
        //if (!player.quests.quests)
        //player.quests = [];
        for (const quest of player.quests.quests)
        {
            if (!quest || quest.status === Types.QuestStatus.COMPLETE  || _.isEmpty(quest))
                continue;
            quests.push(quest.toArray().join(','));
        }

        if (callback)
            callback(player.name, quests);
    }

    loadPlayerDataAchievements(player, callback) {
        let data = "";
        for (const achievement of player.achievements)
        {
            data += achievement.toRedis(achievement).join(',') + ",";
        }
        data = data.slice(0,-1);

        if (callback)
            callback(player.name, data);
    }

    loadPlayerDataItems(player, type, callback) {
        if (callback)
            callback(player.name, type, player.items.itemStore[type].toStringJSON());
    }

    sendToUserServer(msg) {
        if (this.userConnection)
            this.userConnection.send(msg.serialize());
        else
            console.info("worldHandler: sendToUserServer called without userConnection being set: "+JSON.stringify(msg.serialize()));
    }

    savePlayer(player, update) {
        console.info("worldHandler - savePlayer, name:"+player.name);
        const self = this;

        //console.info("SAVING PLAYER: "+player.name);
        //try { throw new Error(); } catch(err) { console.info(err.stack); }
        const username = player.user.name;
        const playerName = player.name;

        const checkLoadDataFull = function (index, data) {
            const objData = self.playerSaveData[playerName];
            objData.count++;
            objData.data[index] = data;
            if (objData.count === 7)
            {
                const msg = new UserMessages.SavePlayerData(playerName, objData.data, update);
                self.sendToUserServer(msg);
                delete self.playerSaveData[playerName];
            }
            else {
                self.playerSaveData[playerName] = objData;
            }
        };

        this.loadPlayerDataUserInfo(player, function (userName, data) {
            const objData = {};
            objData.data = new Array(7);
            objData.count = 0;

            self.playerSaveData[playerName] = objData;

            checkLoadDataFull(0, data);

            self.loadPlayerDataInfo(player, function (pn, data) {
                checkLoadDataFull(1, data);
            });

            self.loadPlayerDataQuests(player, function (pn, data) {
                checkLoadDataFull(2, data);
            });
            self.loadPlayerDataAchievements(player, function (pn, data) {
                checkLoadDataFull(3, data);
            });

            self.loadPlayerDataItems(player, 0, function (pn, type, data) {
                checkLoadDataFull(4, data);
            });
            self.loadPlayerDataItems(player, 1, function (pn, type, data) {
                checkLoadDataFull(5, data);
            });
            self.loadPlayerDataItems(player, 2, function (pn, type, data) {
                checkLoadDataFull(6, data);
            });
        });
    }
}

export default WorldHandler;

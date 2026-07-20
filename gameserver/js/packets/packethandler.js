import Messages from '../message.js';
import { check as formatCheck } from '../format.js';
import PartyHandler from './partyhandler.js';
import ShopHandler from './shophandler.js';
import CombatHandler from './combathandler.js';
import MovementHandler from './movementhandler.js';
import SkillActionHandler from './skillactionhandler.js';
import ItemActionHandler from './itemactionhandler.js';
import WorldActionHandler from './worldactionhandler.js';
import PlayerHandler from './playerhandler.js';
import { Types } from '../common.js';
import SkillData from '../data/skilldata.js';
import { G_DEBUG } from '../constants.js';

/* global EventType */

// This file used to be a single ~1300-line class handling every incoming
// packet type directly. It's now just the connection lifecycle (listen/
// onClose), the dispatch table below, and a handful of small, genuinely
// generic packet handlers (sync time, the CW_REQUEST sub-router, who, and
// config) that didn't obviously belong to any one domain. Everything else
// moved out into sibling files that follow the same constructor(packetHandler)
// convention already established by partyhandler.js/shophandler.js:
//   combathandler.js       -- CW_ATTACK, damage calc, the attack queue
//   movementhandler.js     -- CW_MOVE/CW_MOVEPATH/CW_TELEPORT_MAP
//   skillactionhandler.js  -- CW_SKILL
//   itemactionhandler.js   -- CW_ITEMSLOT/CW_LOOT/appearance
//   worldactionhandler.js  -- CW_CHAT/CW_QUEST/CW_TALKTONPC/CW_BLOCK_MODIFY/harvest
//   playerhandler.js       -- CW_GOLD/CW_STATADD
// (partyhandler.js/shophandler.js already covered CW_PARTY and the
// store/craft/auction traffic before this split.)

// Dispatch table for incoming packets: maps a packet's numeric action code
// (Types.Messages.*) to the handler that services it. This used to be a
// ~30-case switch inline in the connection.listen() callback below -- same
// behavior, but as a Map: it's built once at module load (not re-built or
// re-parsed per connection or per packet), adding/removing a packet type is
// a one-line table entry instead of editing control flow, and dispatch is
// a single Map#get instead of a linear scan through cases. Each entry is a
// thin `(handler, message) => ...` wrapper rather than a bare method
// reference so calls that need to go through `shopHandler`/`partyHandler`
// (instead of a method directly on the PacketHandler) look the same as
// everything else in the table.
const PACKET_HANDLERS = new Map([
    [Types.Messages.BI_SYNCTIME, (h, message) => h.handleSyncTime(message)],
    [Types.Messages.CW_REQUEST, (h, message) => h.handleRequest(message)],
    [Types.Messages.CW_WHO, (h, message) => h.handleWho(message)],
    [Types.Messages.CW_CHAT, (h, message) => h.worldActionHandler.handleChat(message)],
    [Types.Messages.CW_MOVE, (h, message) => h.movementHandler.handleMoveEntity(message)],
    [Types.Messages.CW_MOVEPATH, (h, message) => h.movementHandler.handleMovePath(message)],
    [Types.Messages.CW_ATTACK, (h, message) => h.combatHandler.handleAttack(message)],
    [Types.Messages.CW_ITEMSLOT, (h, message) => h.itemActionHandler.handleItemSlot(message)],
    [Types.Messages.CW_STORESELL, (h, message) => h.shopHandler.handleStoreSell(message)],
    [Types.Messages.CW_STOREBUY, (h, message) => h.shopHandler.handleStoreBuy(message)],
    [Types.Messages.CW_CRAFT, (h, message) => h.shopHandler.handleCraft(message)],
    [Types.Messages.CW_APPEARANCEUNLOCK, (h, message) => h.itemActionHandler.handleAppearanceUnlock(message)],
    [Types.Messages.CW_LOOKUPDATE, (h, message) => h.itemActionHandler.handleLookUpdate(message)],
    [Types.Messages.CW_AUCTIONSELL, (h, message) => h.shopHandler.handleAuctionSell(message)],
    [Types.Messages.CW_AUCTIONBUY, (h, message) => h.shopHandler.handleAuctionBuy(message)],
    [Types.Messages.CW_AUCTIONOPEN, (h, message) => h.shopHandler.handleAuctionOpen(message)],
    [Types.Messages.CW_AUCTIONDELETE, (h, message) => h.shopHandler.handleAuctionDelete(message)],
    [Types.Messages.CW_STORE_MODITEM, (h, message) => h.shopHandler.handleStoreModItem(message)],
    [Types.Messages.CW_TELEPORT_MAP, (h, message) => h.movementHandler.handleTeleportMap(message)],
    [Types.Messages.CW_LOOT, (h, message) => h.itemActionHandler.handleLoot(message)],
    [Types.Messages.CW_TALKTONPC, (h, message) => h.worldActionHandler.handleTalkToNPC(message)],
    [Types.Messages.CW_QUEST, (h, message) => h.worldActionHandler.handleQuest(message)],
    [Types.Messages.CW_GOLD, (h, message) => h.playerHandler.handleGold(message)],
    [Types.Messages.CW_STATADD, (h, message) => h.playerHandler.handleStatAdd(message)],
    [Types.Messages.CW_SKILL, (h, message) => h.skillActionHandler.handleSkill(message)],
    [Types.Messages.CW_SHORTCUT, (h, message) => h.handleShortcut(message)],
    [Types.Messages.CW_BLOCK_MODIFY, (h, message) => h.worldActionHandler.handleBlock(message)],
    [Types.Messages.CW_PARTY, (h, message) => h.partyHandler.handleParty(message)],
    [Types.Messages.CW_HARVEST, (h, message) => h.worldActionHandler.handleHarvest(message)],
    [Types.Messages.CW_USE_NODE, (h, message) => h.worldActionHandler.handleUseNode(message)],
    [Types.Messages.CW_CONFIG, (h, message) => h.handleConfig(message)],
]);

class PacketHandler {
    constructor(player, connection, worldServer) {
        this.player = player;
        this.user = player.user;
        this.connection = player.connection;
        this.world = this.server = player.world;
        this.partyHandler = new PartyHandler(this);
        this.shopHandler = new ShopHandler(this);
        this.combatHandler = new CombatHandler(this);
        this.movementHandler = new MovementHandler(this);
        this.skillActionHandler = new SkillActionHandler(this);
        this.itemActionHandler = new ItemActionHandler(this);
        this.worldActionHandler = new WorldActionHandler(this);
        this.playerHandler = new PlayerHandler(this);

        const self = this;

        this.connection.listen(function(message) {
            // PERF: this fires for every single incoming packet from every
            // connected player (movement, attacks, chat, ...). JSON.stringify
            // on a hot path like this is real, measurable CPU cost even when
            // nothing reads the output, so it's gated behind G_DEBUG instead
            // of unconditionally stringifying every packet.
            if (G_DEBUG)
                console.info("recv="+JSON.stringify(message));
            const action = parseInt(message[0]);
            if (isNaN(action)) {
                // FIX: this callback is a plain (non-arrow) function, so `this`
                // here is not the PacketHandler instance -- it's `self`, captured
                // a few lines above, that correctly refers to it. `this.connection`
                // threw a TypeError instead of closing the malformed connection.
                self.connection.close("Invalid message");
                return;
            }

            if(!formatCheck(message)) {
                self.connection.close("Invalid "+Types.getMessageTypeAsString(action)+" message format: "+message);
                return;
            }
            message.shift();

            self.user.lastPacketTime = Date.now();

            // FIX: wrapped in try/catch -- this listen() callback runs directly
            // on socket.io's event emitter, which has no catch of its own around
            // listener callbacks. Previously, any handler throwing (malformed
            // payload, unexpected null, etc.) would propagate out of here
            // uncaught; depending on where/how Node surfaces an exception thrown
            // from inside an event emitter's listener, that risked taking down
            // the whole process -- and every other connected player's
            // connection with it -- over one bad packet from one client.
            // Containing it here means a single player can, at worst, break
            // their own connection.
            try {
                const handler = PACKET_HANDLERS.get(action);
                if (handler) {
                    handler(self, message);
                } else if (self.message_callback) {
                    // NOTE: kept exactly as in the original default case --
                    // this checks `self.message_callback` but invokes
                    // `self.player.message_callback`, two different properties.
                    // Pre-existing quirk, not introduced by this refactor; left
                    // as-is since fixing it would be a behavior change outside
                    // the scope of converting the switch to a dispatch table.
                    self.player.message_callback(message);
                }
            } catch (err) {
                console.error("PacketHandler: error handling action=" + action + " for player " + (self.player && self.player.name) + ": " + (err && err.stack || err));
            }
        });

        this.connection.onClose(function() {
            console.info("Player: " + self.player.name + " has exited the world.");

            self.player.save();

            console.info("REMOVING PLAYER FROM WORLD.");

            if (self.exit_callback) {
                console.info("exit callback.");
                self.exit_callback(self.player);
            }

            console.info("onClose - called");
        });

    }

    timeout() {
        this.connection.sendUTF8("timeout");
        this.connection.close("Player was idle for too long");
    }

    broadcast(message, ignoreSelf) {
        if (this.broadcast_callback) {
            this.broadcast_callback(message, ignoreSelf === undefined ? true : ignoreSelf);
        }
    }


    onExit(callback) {
        console.info("packetHandler, onExit.");
        this.exit_callback = callback;
    }

    onMove(callback) {
        this.move_callback = callback;
    }

    onMessage(callback) {
        this.message_callback = callback;
    }

    onBroadcast(callback) {
        this.broadcast_callback = callback;
    }

    send(message) {
        this.connection.send(message);
    }

    sendPlayer(message) {
        this.player.sendPlayer(message);
    }

    sendToPlayer(player, message) {
        this.player.sendToPlayer(player, message);
    }

    handleSyncTime(message) {
        console.info("handleSyncTime");
        const clientTime = parseInt(message[0]);
        this.send([Types.Messages.BI_SYNCTIME, clientTime, Date.now()]);
    }

    handleRequest(msg) {
        const type = parseInt(msg);
        const p = this.player;

        switch (type) {
        case 0: // CW_APPEARANCELIST
            this.handleAppearanceList(msg);
            break;
        case 1: // CW_PLAYER_REVIVE
            this.handleRevive(msg);
            break;
        case 2: // CW_PLAYERINFO
            this.handlePlayerInfo(msg);
            break;
        case 3: // CW_WHO REQUEST
            p.map.entities.processWho(p);
            break;
        }
    }

    handleAppearanceList(msg) {
        this.server.looks.sendLooks(this.player);
    }

    handleRevive(msg) {
        const p = this.player;
        if (p.isDead === true) {
            console.info("handled Revive!!");
            p.respawn();
            p.map.entities.sendNeighbours(p, new Messages.Spawn(p), p);
            // NOTE: `handleRevive`'s `msg` parameter is unused in this
            // function -- the outgoing message gets its own name (sendMsg)
            // instead of reusing/overwriting the `msg` parameter binding.
            const sendMsg = new Messages.Move(p, p.orientation, 2, p.x, p.y);
            this.sendPlayer(sendMsg);
        }
    }

    handlePlayerInfo(msg) {
        this.sendPlayer(new Messages.PlayerInfo(this.player));
    }

    handleWho(message) {
        // FIX (real, still-live bug on top of the string/number one below):
        // client/js/gameclient.js's sendWho(ids) sends
        // `[Types.Messages.CW_WHO, ids]` -- `ids` (a real array, e.g.
        // `delist` built in game.js via `delist.push(entity.id)`) is one
        // NESTED element of the outer message, matching CW_WHO's format.js
        // schema (`tupleField([arrayField(numberField(...),0,999)])` --
        // i.e. "one field, which is an array"). So after packethandler.js's
        // outer `message.shift()` removes the packet type, `message` here
        // is `[idsArray]` -- a ONE-ELEMENT array whose sole element is the
        // real ids array -- not the flat ids list this code assumed.
        // `if (message.length > 0) ids = message;` therefore always set
        // `ids` to that one-element wrapper, so the loop below ran exactly
        // once with `id` bound to the whole ids ARRAY, and
        // `Number(idsArray)` is NaN for any array with more than one entry
        // (confirmed: sending ids=[5,17,42] computed Number()->NaN every
        // time, never 5/17/42). Utils.removeFromArray()'s indexOf() never
        // matches NaN against a real stored id, so this was a silent
        // no-op regardless of what the client sent -- this.player.knownIds
        // was never actually pruned, just grew for the life of the
        // session. The FIX comment this replaces already fixed the
        // string-vs-number half of that (Number(id) is still correct and
        // needed once `ids` is unwrapped correctly below); it just didn't
        // catch that `ids` itself was still the wrong, one-level-too-deep
        // array. Read message[0] (the real ids array) instead of treating
        // `message` itself as the ids list.
        const ids = (message[0] && message[0].length > 0) ? message[0] : [];

        // PERF: Utils.removeFromArray() is indexOf+splice, O(n) per call.
        // Calling it once per id against the same knownIds array made this
        // O(n*m) (n = knownIds size, m = ids to remove) -- and knownIds is
        // "the single most frequently invoked query in the game" per the
        // processWho comments elsewhere in this file. A CW_WHO request can
        // carry dozens-to-hundreds of stale ids at once (map transitions).
        // Build a Set of ids to drop and do a single filter() pass instead.
        const removeSet = new Set(ids.map(Number));
        this.player.knownIds = this.player.knownIds.filter((id) => !removeSet.has(id));
    }


    // FIX: format.js only bounds this packet's numeric value against
    // mapCoordsMax (16384) -- a generic pixel-coordinate limit, not a real
    // limit on screenWidth/screenHeight specifically. Those two config keys
    // are the radius MapEntities.processWho() (the hottest spatial query in
    // the engine, run on every move/attack/chat/spawn/despawn) uses to decide
    // how much of the map to scan for a player. Without a dedicated clamp
    // here, a client could set either to something close to 16384 to (a)
    // see/track every entity on the whole map regardless of its actual
    // camera size (a wallhack/radar-style cheat), and (b) force a full-map
    // scan on every single hot-path call instead of a local-neighborhood
    // one, for a cheap, repeatable perf hit. Clamped to the real default
    // (50, see player.js's constructor) plus a little headroom for
    // legitimately larger screens/zoom levels, independent of whatever
    // format.js allows generically for this field. (Using inline
    // Math.min/max rather than a Utils helper here since utils.js re-exports
    // from a shared module outside this project's tree that wasn't
    // reachable to confirm a clamp() helper exists on it.)
    static MAX_SCREEN_DIM = 100;

    // NOTE: CW_SHORTCUT binds an item/skill to a hotbar slot -- it doesn't
    // cast a skill or touch an item entity, it's a client-preference write
    // (player.shortcuts), same category as handleConfig() right below. Kept
    // here rather than in skillactionhandler.js/itemactionhandler.js for
    // that reason, even though it needs SkillData for the type===2 bound.
    handleShortcut(message) {
        const slot = parseInt(message[0]);
        const type = parseInt(message[1]);
        const shortcutId = parseInt(message[2]);

        // A shortcut's type is always 1 (item) or 2 (skill) -- there is no
        // type 0. format.js's CW_SHORTCUT schema already enforces this same
        // [1, 2] range, so this is a second explicit guard, not the source
        // of truth for it.
        if (type < 1 || type > 2)
          return;

        // Slot is always 0-5 (player.js's load path, fillPlayerInfo, only
        // restores slots < 6) regardless of shortcut type. format.js's
        // CW_SHORTCUT schema now enforces this same [0, 5] range via
        // playerShortcutsMax, so -- like the type check above -- this is a
        // second explicit guard, not the source of truth for it.
        //
        // FIX: this bound used to only run inside an `if (type === 1)`
        // branch, leaving type === 2 (skill) shortcuts free to save into
        // slot 6/7 (back when format.js's own bound was also looser, 0-7).
        // Slot validity doesn't depend on shortcut type, so this check now
        // runs unconditionally for both.
        if (slot < 0 || slot > 5)
            return;

        // type === 1 (item): shortcutId is an item kind, already bounded
        // against itemKindMax by format.js's CW_SHORTCUT schema, so no extra
        // check is needed here.
        // type === 2 (skill): shortcutId indexes SkillData.Skills, a much
        // smaller list than itemKindMax, so it needs its own tighter bound.
        if (type === 2) {
            if (shortcutId < 0 || shortcutId >= SkillData.Skills.length)
                return;
        }

        this.player.shortcuts[slot] = [slot, type, shortcutId];
    }

    handleConfig(msg) {
      const arr = msg[0];
      const p = this.player;

      for (const val of arr) {
        const key = val[0];
        let value = val[1];

        if (!p.config.hasOwnProperty(key))
          continue;

        if (key === 'screenWidth' || key === 'screenHeight')
          value = Math.max(1, Math.min(value, PacketHandler.MAX_SCREEN_DIM));

        p.config[key] = value;
      }
    }
}

export default PacketHandler;

import Character from '../entity/character.js';
import Mob from '../entity/mob.js';
import Node from '../entity/node.js';
import Messages from '../message.js';
import Formulas from '../formulas.js';
import { check as formatCheck } from '../format.js';
import PartyHandler from './partyhandler.js';
import ShopHandler from './shophandler.js';
import Item from '../entity/item.js';
import Block from '../entity/block.js';
import Player from '../entity/player.js';
import Utils from '../utils.js';
import { Types } from '../common.js';
import AppearanceData from '../data/appearancedata.js';
import SkillData from '../data/skilldata.js';
import { G_LATENCY, G_TILESIZE, ATTACK_INTERVAL, mobState, G_DEBUG } from '../main.js';
import { PlayerEvent } from '../world/taskhandler.js';

/* global EventType */

class PacketHandler {
    constructor(player, connection, worldServer) {
        this.player = player;
        this.user = player.user;
        this.connection = player.connection;
        this.world = this.server = player.world;
        this.partyHandler = new PartyHandler(this);
        this.shopHandler = new ShopHandler(this);

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

            switch (action) {
            case Types.Messages.BI_SYNCTIME:
                self.handleSyncTime(message);
                break;

            case Types.Messages.CW_REQUEST:
                self.handleRequest(message);
                break;

            case Types.Messages.CW_WHO:
                self.handleWho(message);
                break;

            case Types.Messages.CW_CHAT:
                self.handleChat(message);
                break;

            case Types.Messages.CW_MOVE:
                self.handleMoveEntity(message);
                break;

            case Types.Messages.CW_MOVEPATH:
                self.handleMovePath(message);
                break;

            case Types.Messages.CW_ATTACK:
                self.handleAttack(message);
                break;

            case Types.Messages.CW_ITEMSLOT:
                self.handleItemSlot(message);
                break;

            case Types.Messages.CW_STORESELL:
                self.shopHandler.handleStoreSell(message);
                break;
            case Types.Messages.CW_STOREBUY:
                self.shopHandler.handleStoreBuy(message);
                break;
            case Types.Messages.CW_CRAFT:
                self.shopHandler.handleCraft(message);
                break;
            case Types.Messages.CW_APPEARANCEUNLOCK:
                self.handleAppearanceUnlock(message);
                break;
            case Types.Messages.CW_LOOKUPDATE:
                self.handleLookUpdate(message);
                break;
            case Types.Messages.CW_AUCTIONSELL:
                self.shopHandler.handleAuctionSell(message);
                break;

            case Types.Messages.CW_AUCTIONBUY:
                self.shopHandler.handleAuctionBuy(message);
                break;

            case Types.Messages.CW_AUCTIONOPEN:
                self.shopHandler.handleAuctionOpen(message);
                break;

            case Types.Messages.CW_AUCTIONDELETE:
                self.shopHandler.handleAuctionDelete(message);
                break;

            case Types.Messages.CW_STORE_MODITEM:
                self.shopHandler.handleStoreModItem(message);
                break;

            case Types.Messages.CW_TELEPORT_MAP:
                self.handleTeleportMap(message);
                break;
            case Types.Messages.CW_LOOT:
                self.handleLoot(message);
                break;
            case Types.Messages.CW_TALKTONPC:
                self.handleTalkToNPC(message);
                break;
            case Types.Messages.CW_QUEST:
                self.handleQuest(message);
                break;
            case Types.Messages.CW_GOLD:
                self.handleGold(message);
                break;
            case Types.Messages.CW_STATADD:
                self.handleStatAdd(message);
                break;
            case Types.Messages.CW_SKILL:
                self.handleSkill(message);
                break;
            case Types.Messages.CW_SHORTCUT:
                self.handleShortcut(message);
                break;
            case Types.Messages.CW_BLOCK_MODIFY:
                self.handleBlock(message);
                break;

            case Types.Messages.CW_PARTY:
                self.partyHandler.handleParty(message);
                break;

            case Types.Messages.CW_HARVEST:
                self.handleHarvest(message);
                break;

            case Types.Messages.CW_USE_NODE:
                self.handleUseNode(message);
                break;
            case Types.Messages.CW_CONFIG:
                self.handleConfig(message);
                break;

            default:
                if (self.message_callback)
                    self.player.message_callback(message);
                break;
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

    handleChat(message) {
        // FIX: unlike movement/attacks, chat had no rate limiting at all, so
        // a client could spam CW_CHAT as fast as the socket allowed and have
        // every message broadcast to the entire world. Reject (rather than
        // silently drop) so the client isn't left wondering why nothing sent.
        if (!this.player.chatCooldown.isOver()) {
            this.send([Types.Messages.WC_NOTIFY, "CHAT", "CHATFLOOD"]);
            return;
        }

        let msg = Utils.sanitize(message[0]);
        console.info("Chat: " + this.player.name + ": " + msg);

        if ((new Date()).getTime() > this.player.chatBanEndTime) {
            this.send([Types.Messages.WC_NOTIFY, "CHAT", "CHATMUTED"]);
            return;
        }

        if (msg) {
            msg = msg.substr(0, 256); //Will have to change the max length
            const command = msg.split(" ", 3)
            switch (command[0]) {
            case "/w":
                this.send([Types.Messages.WC_NOTIFY, "CHAT", "CHATMUTED"]);
                break;
            default:
                // FIX: Messages.Chat's constructor is (player, group,
                // message) and serialize() sends [WC_CHAT, playerId, group,
                // message] -- but this call only passed 2 args, so `msg`
                // (the actual chat text) landed in the `group` field and
                // `message` was undefined. Every chat packet sent to clients
                // was malformed. This is a single world-wide channel here,
                // so pass "world" as the group and the real text as message.
                this.server.sendWorld(new Messages.Chat(this.player, "world", msg));
                break;

            }
        }
    }

    handleQuest(msg) {
        console.info("handleQuest");
        const npcId = parseInt(msg[0]);
        const questId = parseInt(msg[1]);
        const status = parseInt(msg[2]);

        const p = this.player;
        const npc = p.map.entities.getEntityById(npcId);
        // FIX: isInScreen(pos) expects an [x,y] array (see the correct call
        // in player.js's getExpBonus: isInScreen([player.x,player.y])), not a
        // raw entity. Passing `npc` meant npc[0]/npc[1] were always
        // undefined, so Math.abs(this.x - undefined) -> NaN -> ~~NaN -> 0,
        // and `0 <= threshold` is always true -- the proximity check was
        // completely defeated, letting players accept/reject quests from
        // anywhere on the map. Also added a null-check: if npcId doesn't
        // resolve to a real entity, `npc` is undefined and npc.x would throw.
        if (!npc || !p.isInScreen([npc.x, npc.y])) {
            console.info("player not close enough to NPC!");
            return;
        }

        if (status === 1)
            npc.entityQuests.acceptQuest(p, questId);
        else {
            npc.entityQuests.rejectQuest(p, questId);
        }
    }

    handleTalkToNPC(message) { // 30
        console.info("handleTalkToNPC");
        const type = parseInt(message[0]);
        const npcId = parseInt(message[1]);

        const p = this.player;
        const npc = p.map.entities.getEntityById(npcId);
        // FIX: same isInScreen(npc) -> isInScreen([npc.x,npc.y]) bug as
        // handleQuest above, plus a null-check on npc before using its
        // coordinates.
        if (!npc || !p.isInScreen([npc.x, npc.y])) {
            console.info("player not close enough to NPC!");
            return;
        }

        npc.talk(p);
    }

    handleAppearanceUnlock(message) {
        const appearanceIndex = parseInt(message[0]);
        const priceClient = parseInt(message[1]);

        if (appearanceIndex < 0 || appearanceIndex >= AppearanceData.Data.length)
            return;

        const itemData = AppearanceData.Data[appearanceIndex];
        if (!itemData)
            return;

        if (!(itemData.type === "armorarcher" || itemData.type === "armor"))
            return;

        const price = this.server.looks.prices[appearanceIndex];
        if (price !== priceClient) {
            this.sendPlayer(new Messages.Notify("SHOP", "SHOP_MISMATCH", [itemData.name]));
            this.server.looks.sendLooks(this.player);
            return;
        }

        let gemCount = 0;

        if (appearanceIndex >= 0) {
            gemCount = this.player.user.gems;

            console.info("gemCount=" + gemCount);

            if (gemCount >= price) {
                this.player.user.looks[appearanceIndex] = 1;
                // FIX: modifyGems() is defined on PlayerItems (player.items),
                // not directly on Player -- calling this.player.modifyGems(...)
                // threw "not a function", so appearance/gem purchases never
                // actually completed (and the gem cost was never deducted).
                this.player.items.modifyGems(-price);
                this.server.looks.prices[appearanceIndex] += 100;

                this.sendPlayer(new Messages.Notify("SHOP", "SHOP_SOLD", [itemData.name]));
                this.server.looks.sendLooks(this.player);
            } else {
                this.sendPlayer(new Messages.Notify("SHOP", "SHOP_NOGEMS"));
            }
        }
    }

    handleLookUpdate(message) {
        const type = parseInt(message[0]),
            id = parseInt(message[1]);

        const p = this.player;
        if (id < 0 || id >= AppearanceData.Data.length)
            return;
        if (type < 0 || type > 1)
            return;

        const itemData = AppearanceData.Data[id];
        if (!itemData)
            return;

        if (!(itemData.type === "armorarcher" || itemData.type === "armor"))
            return;

        const appearance = this.player.user.looks[id];
        if (appearance === 1) {
            if (type === 0) {
                p.setSprite(0, id);
            }
        }

        p.broadcastSprites();
    }


// param 1 - action type.
// type 0 eat.
// type 1 equip.
// type 2 move item.
// type 3 drop item.
// type 4 store item.

// param 2 - slot type.
// slot 0 inventory.
// slot 1 equipment.
// slot 2 bank.

// param 3 slot index. (0-48).
// param 4 count of items.

// param 5 - slot type 2.
// param 6 - slot index 2.
// param 7 - count of items 2.

    handleItemSlot(msg) { // 28
        const self = this;
        const action = parseInt(msg[0]);

        if (this.player.isDead)
            return;

        // slot type, slot index, slot count.
        const slot = [Number(msg[1]), Number(msg[2]), Number(msg[3])];
        // FIX: this only bounds-checked slot type 2, and against
        // equipment's maxNumber (5) instead of that slot type's real store
        // size -- rejecting valid slots for whichever store type 2 actually
        // is. Worse, the other two slot types got no bounds check at all
        // here. itemStore[0..2] map to inventory(max 50)/bank(max 96,
        // items/bank.js)/equipment(max 5, items/equipment.js) respectively
        // -- confirmed against user/userhandler.js's handleLoadPlayerItems,
        // which is the code that actually constructs and assigns
        // itemStore[type] for type 0/1/2 (an earlier version of this
        // comment had the 1/2 order backwards: bank is slot type 1, not
        // equipment). Validate whichever store the requested slot type
        // actually is.
        const itemStore = this.player.items.itemStore[slot[0]];
        if (!itemStore || slot[1] < 0 || slot[1] >= itemStore.maxNumber)
            return;
        let item = null;
        if (slot[1] >= 0)
            item = this.player.items.getStoredItem(slot[0], slot[1], slot[2]);

        let slot2 = null;
        if (msg.length === 6)
        {
            slot2 = [Number(msg[4]), Number(msg[5])];
            // FIX: `slot` above is validated against its itemStore's
            // maxNumber, but slot2 wasn't validated at all before being
            // handed to items.swapItem(), which indexes
            // this.itemStore[slot2[0]] and then .rooms[slot2[1]] -- a
            // crafted CW_ITEMSLOT packet with an out-of-range slot2 could
            // throw deep inside swapItem(). -1 is a legitimate sentinel here
            // (see equipmenthandler.js/bankdialog.js client callers) meaning
            // "no specific target slot, let swapItem() place it wherever
            // there's room" -- swapItem() already branches on
            // `slot2[1] >= 0` for this, so only reject values that are
            // neither -1 nor a valid in-range slot.
            const itemStore2 = this.player.items.itemStore[slot2[0]];
            if (!itemStore2 || (slot2[1] !== -1 && (slot2[1] < 0 || slot2[1] >= itemStore2.maxNumber)))
                return;
            if (slot[0] === slot2[0] && slot[1] === slot2[1])
                return;
        }
        if (action === 0) {
            this.player.items.handleInventoryEat(item, slot[1]);
        }
        else if (action === 1) {
            this.player.items.swapItem(slot, slot2);
        }
        else if (action === 2) { // drop item.
            this.player.items.handleStoreEmpty(slot, item);
        }
    }

    // NOTE: `item` was a bare (undeclared) assignment in the original CommonJS
    // source, which created an implicit global there; declared with `var` here
    // since ES modules are always strict mode and forbid implicit globals.
    handleLoot(message) {
        console.info("handleLoot");

        const p = this.player;
        const item = p.map.entities.getEntityById(parseInt(message[0]));
        if (!item) {
            console.info("no item.");
            return;
        }

        // FIX: this checked the player's distance against the
        // CLIENT-SUPPLIED x/y (message[1]/message[2]) instead of the item
        // entity's actual server-side position (item.x/item.y). A crafted
        // CW_LOOT packet could set x/y to the player's own current
        // position -- trivially passing isWithinDist() regardless of where
        // the item entity actually was -- letting a client loot any item
        // anywhere on the map just by knowing its entity id. Checking
        // against the item's real, authoritative position closes that off;
        // message[1]/message[2] are no longer needed once the check uses
        // the entity itself.
        // FIX: a subsequent edit changed this to `p.canReachEntity(item)`,
        // but that method doesn't exist anywhere in the codebase (Player/
        // Character only has `canReach()`, which is a weapon-attackRange
        // check meant for combat, not a generic proximity helper) --
        // every CW_LOOT packet would throw a TypeError here, breaking
        // looting entirely. `isWithinDistEntity()` (entity/entity.js) is
        // the real, existing helper for "is this entity within N pixels of
        // me" and keeps the same 24px pickup radius as before.
        if (!p.isWithinDistEntity(item, 24)) {
            console.info("Player is not close enough to item.")
            return;
        }

        console.info("item="+item.toString());
        if (item.enemyDrop)
            console.info("enemyDrop");

        if (item instanceof Item) {
            if (p.items.inventory.putItem(item.room) >= 0) {
                this.server.taskHandler.processEvent(p, PlayerEvent(Types.EventType.LOOTITEM, item, 1));
                this.broadcast(item.despawn(), false);
                p.map.entities.removeEntity(item);
            }
        }
    }

    handleAttack(message) {
        const self = this;
        const time = parseInt(message[0]);
        const p = this.player;

        if (p.isDead)
            return;

        if (p.isMoving() || p.isMovingPath()) {
            p.attackQueue = message;
        } else {
            self.handleHitEntity(p, message);
        }
    }

    processAttack() {
        const p = this.player;

        if (p.attackQueue) {
            this.handleHitEntity(p, p.attackQueue);
            p.attackQueue = null;
        }
    }

    handleHitEntity(sEntity, message) { // 8
        const self = this;
        const p = this.player;

        const targetId = parseInt(message[1]),
            orientation = parseInt(message[2]),
            skillId = parseInt(message[3]);

        if (targetId < 0) {
            console.warn("invalid targetId");
            return;
        }

        const tEntity = sEntity.map.entities.getEntityById(targetId);
        if (!tEntity) {
            console.warn("invalid entity");
            return;
        }

        const attackTime = Date.now() - sEntity.attackTimer + 100;
        if (attackTime < ATTACK_INTERVAL) {
            console.warn("attack interval");
            return;
        }

        // If PvP then both players must be level 20 or higher.
        if (tEntity instanceof Player && sEntity instanceof Player &&
            (sEntity.level < 20 || tEntity.level < 20 ||
              Math.abs(sEntity.level-tEntity.level) > 10))
        {
            console.warn("pvp invalid diff");
            return;
        }

        if (tEntity.aiState === mobState.RETURNING)
            return;

        if (tEntity.invincible) {
            this.sendPlayer(new Messages.Notify("CHAT","COMBAT_TARGETINVINCIBLE"));
            console.warn("target invincible");
            return;
        }

// TODO fill sEntity, tEntity.

        if (sEntity.map.isColliding(sEntity.x, sEntity.y)) {
            console.warn("char.isColliding("+sEntity.id+","+sEntity.x+","+sEntity.y+")");
            return;
        }

        if (skillId >= 0) {
            this.handleSkill([skillId, targetId, tEntity.x, tEntity.y]);
        }

        sEntity.setOrientation(orientation);
        sEntity.engage(tEntity);

        if (sEntity === this.player) {
            if (!sEntity.canReach(tEntity)) {
                console.info("Player not close enough!");
                console.info("p.x:" + sEntity.x + ",p.y:" + sEntity.y);
                console.info("e.x:" + tEntity.x + ",e.y:" + tEntity.y);
                console.info("dx:"+Math.abs(sEntity.x-tEntity.x)+",dy:"+Math.abs(sEntity.y-tEntity.y));
                return;
            }

            if (!sEntity.attackedTime.isOver()) {
                console.warn("attackedTime is not over.");
                return;
            }
            sEntity.isHarvesting = false;
        }

        sEntity.isBlocking = false;
        sEntity.hasAttacked = true;

        const fnDamage = function (sEntity, tEntity, damageObj) {
            if (sEntity instanceof Player && tEntity instanceof Mob) {
                tEntity.mobAI.checkHitAggro(tEntity, sEntity);
            }
            self.dealDamage(sEntity, tEntity, damageObj.damage, damageObj.crit);
        };

        if (sEntity.effectHandler) {
            sEntity.effectHandler.interval("beforehit",0);
        }
        const damageObj = this.calcDamage(sEntity, tEntity, null, 0); // no skill

        if (sEntity.effectHandler) {
            sEntity.effectHandler.interval("onhit", damageObj.damage);
            for (const skillEffect of sEntity.activeEffects)
            {
                const data = skillEffect.data;
                if (data.skillType === "attack" && data.targetType === "enemy_aoe")
                {
                    const damageObjAOE = this.calcDamageAOE(sEntity, null, 0);
                    for (const target of skillEffect.targets) {
                        if (target === tEntity)
                            continue;
                        else
                            fnDamage(sEntity, target, damageObjAOE);
                    }
                }
            }
        }
        fnDamage(sEntity, tEntity, damageObj);

        if (sEntity.attackTimer)
            sEntity.attackTimer = Date.now();

        if (sEntity.effectHandler) {
            sEntity.effectHandler.interval("afterhit",0);
        }
    }

    calcDamageAOE(sEntity, skill, attackType) {
        const damageObj = {
            damage: 0,
            crit: 0,
            dot: 0
        };

        damageObj.damage = Math.round(Formulas.dmgAOE(sEntity));
        return damageObj;
    }

    calcDamage(sEntity, tEntity, skill, attackType) {
        const damageObj = {
            damage: 0,
            crit: 0,
            dot: 0
        };

        damageObj.damage = Math.round(Formulas.dmg(sEntity, tEntity));
        if (damageObj.damage === 0)
            return damageObj;

        const canCrit = Formulas.crit(sEntity, tEntity);
        if (canCrit) {
            damageObj.damage *= 2;
            damageObj.crit = 1;
        }
        return damageObj;
    }

    dealDamage(sEntity, tEntity, dmg, crit) {
        if (!tEntity) return;

        if (tEntity instanceof Mob)
            tEntity.aggroPlayer(sEntity);

        this.server.handleDamage(tEntity, sEntity, -dmg, crit);
        if (sEntity instanceof Player)
            sEntity.weaponDamage += dmg;

        if (tEntity instanceof Player) {
            if (tEntity.isDead) {
                if (sEntity === this.player)
                    this.player.map.entities.sendBroadcast(new Messages.Notify("CHAT","COMBAT_PLAYERKILLED", [sEntity.name, tEntity.name]));

                sEntity.pStats.pk++;
                tEntity.pStats.pd++;
            }
        }
    }

    handleShortcut(message) {
        const slot = parseInt(message[0]);
        const type = parseInt(message[1]);
        const shortcutId = parseInt(message[2]);

        // FIX: was `slot > 7`, accepting 8 shortcut slots -- but player.js's
        // load path (fillPlayerInfo) only restores slots < 6, so anything
        // saved into slot 6/7 silently vanished on the next login. Capped
        // here to match what's actually persisted.
        if (slot < 0 || slot > 5)
            return;

        if (type === 2) {
            if (shortcutId < 0 || shortcutId >= SkillData.Skills.length)
                return;
        }

        this.player.shortcuts[slot] = [slot, type, shortcutId];
    }

    handleSkill(message) {
        const skillId = parseInt(message[0]),
            targetId = parseInt(message[1]),
            x = parseInt(message[2]),
            y = parseInt(message[3]),
            p = this.player;

        if (p.isDead)
            return;

        if (skillId < 0 || skillId >= p.skills.length)
            return;

        const skill = p.skills[skillId];

        // Perform the skill.
        let target;
        if (targetId) {
            target = p.map.entities.getEntityById(targetId);
            if (!target)
                return;
            // FIX: any entity id the client has seen (Item, Block, Node,
            // NpcStatic -- not just Player/Mob) is a valid, reachable
            // getEntityById() result, but only Character (Player/Mob)
            // subclasses have the `activeEffects` skill-effect state that
            // effectHandler.cast() below needs for "enemy"/"ally"-targeted
            // skills. Casting at a non-Character id reached
            // effecthandler.js's applyEffect() -> target.activeEffects
            // .indexOf(...) and threw -- but only *after* skill.xp(1) had
            // already run and the SkillEffect was already registered in
            // skillEffects with no cleanup path, since the "end" phase that
            // normally deregisters it was never reached. Reject before any
            // of that happens.
            if (!(target instanceof Character))
                return;

            // FIX: unlike handleHitEntity() (the plain-attack path, which
            // gates on sEntity.canReach(tEntity) before doing anything),
            // this had no distance check at all -- a client could send
            // CW_SKILL with any entity id it had ever seen on the map and
            // get full skill damage/heal/effects applied instantly,
            // regardless of actual distance from the caster. That's a
            // map-wide ranged-attack/heal hack, and it also let skill.xp(1)
            // (below) be farmed for free from a safe distance. Reuse the
            // same canReach() range gate the base attack path already
            // trusts -- it's keyed off the caster's own attackRange, so
            // melee and ranged characters are still bound by whatever range
            // rules already apply to their normal attacks.
            if (!p.canReach(target))
                return;
        }

        // Make sure the skill is ready.
        if (!skill.isReady())
            return;

        p.effectHandler.cast(skillId, target, x, y);

        this.handleSkillEffects(p, target);
    }

    // SIMPLIFY: this used to build the "which effect ids are currently
    // active" list twice with copy-pasted loops (once for source, once for
    // target). Factored the loop out; behavior unchanged.
    _getActiveEffectIds(entity) {
        const effects = [];
        for (const [k, v] of Object.entries(entity.effects)) {
            if (v === 1)
                effects.push(parseInt(k));
        }
        return effects;
    }

    handleSkillEffects(source, target)
    {
        if (!source.effects)
            return;

        this.sendToPlayer(source, new Messages.SkillEffects(source, this._getActiveEffectIds(source)));

        if (!target) return;

        this.sendToPlayer(source, new Messages.SkillEffects(target, this._getActiveEffectIds(target)));
    }

    // TODO map enforce for all calls.
    handleMoveEntity(message) {
        const time = parseInt(message[0]),
            entityId = parseInt(message[1]),
            state = parseInt(message[2]),
            orientation = parseInt(message[3]),
            x = parseInt(message[4]) || -1,
            y = parseInt(message[5]) || -1;

        const p = this.player;
        if (entityId !== p.id)
            return;

        if (state==1 && p.hasMoveThrottled(G_LATENCY))  {
            console.warn("handleMoveEntity - moveThrottled");
            p.resetMove(p.x,p.y);
            return;
        }

        if (state === 2) {
            if (!p.checkStartMove(x,y)) {
                console.error("handleMoveEntity, checkStartMove - x:"+x+",y:"+y);
                console.error("handleMoveEntity, checkStartMove - p.x:"+p.x+",p.y:"+p.y);
                p.resetMove(p.x,p.y);
            }
            p.forceStop();
            return;
        }

        if (state === 1 && !p.checkStartMove(x,y)) {
            p.resetMove(p.x,p.y);
            return;
        }

        const arr = [time, state, orientation, x, y];
        // PERF: runs on every movement packet from every player; gated for
        // the same reason as the recv() log above.
        if (G_DEBUG)
            console.info("handleMoveEntity - arr: "+JSON.stringify(arr));
        if (state === 1) {
            p.move([time, 0, p.orientation, x, y]);
        }
        p.move(arr);

        const msg = new Messages.Move(p, orientation, state, x, y);
        p.map.entities.sendNeighbours(p, msg, p);

        if (this.move_callback)
            this.move_callback();
    }

    handleMovePath(message) {
        const time = parseInt(message.shift()),
            entityId = parseInt(message.shift()),
            orientation = parseInt(message.shift()),
            interrupted = (parseInt(message.shift()) === 0) ? false : true;

        const path = message[0];

        const p = this.player;
        if (entityId !== p.id)
            return;


        if (path && p.hasMoveThrottled(G_LATENCY)) {
            p.resetMove(p.x,p.y);
            console.warn("handleMoveEntity - moveThrottled");
            return;
        }

        // PERF: runs on every path packet from every player.
        if (G_DEBUG)
            console.info(JSON.stringify(path));

        const x = path[0][0],
            y = path[0][1];

        if (!p.checkStartMove(x,y)) {
            p.resetMove(p.x,p.y);
            return;
        }

        p.forceStop();

        if (!p.isValidGridPath(path))
            return;

        if (G_DEBUG)
            console.info("packethandler: handleMoveEntity - movepath: "+JSON.stringify(path));
        p.movePath([time, interrupted], path);

        const msg = new Messages.MovePath(p, path);
        p.map.entities.sendNeighbours(p, msg);
    }

    // TODO - enterCallback x,y not being overridden sometimes,
    // and sending to wrong Map.
    handleTeleportMap(msg) {
        console.info("handleTeleportMap");
        const self = this;
        const mapId = parseInt(msg[0]),
            status = parseInt(msg[1]);
        console.info("status="+status);
        let x = parseInt(msg[2]), y = parseInt(msg[3]);
        const portalId = parseInt(msg[4]);

        const p = this.player;
        if (status <= 0)
        {
            x = -1;
            y = -1;
        }

        if (mapId < 0 || mapId >= self.server.maps.length)
        {
            console.info("Map non-index");
            return;
        }

        const map = self.server.maps[mapId];
        // FIX: was `map.ready` -- that's map.js's method that registers the
        // onLoad callback, not a load-state flag (see the FIX comments in
        // map.js's initMap() and worldserver.js's forEachMap() for the same
        // issue). A function reference is always truthy, so this check
        // never actually caught a target map that hadn't finished loading
        // yet -- it passed unconditionally as long as `map` existed at all,
        // letting a player teleport onto a map whose `entities`/`doors`
        // might not be initialized yet. `isReady` is the real boolean.
        if (!(map && map.isReady)) {
            console.info("Map non-existant or not ready");
            return;
        }

        if (portalId >= 0 && portalId >= p.map.doors.length) {
            console.info("Teleport does not exist.");
            return;
        }

        if (status === 0) {
            p.forceStop();
            p.mapStatus = 0;
            p.clearTarget();

            p.handleTeleport();

            p.map.entities.removePlayer(p);

            // FIX (cleanup): `map.enterCallback(p)` was called here but its
            // result was immediately discarded by the `pos = {x: p.x, y: p.y}`
            // reassignment right below, and its actual purpose (a random
            // starting position for non-door teleports) is already handled
            // later in this function at `pos = p.map.getRandomStartingPosition()`
            // once `p.map` has been updated to the destination map. Removed the
            // dead call rather than leaving a no-op that looks load-bearing.

            let pos = {x: p.x, y: p.y};
            let isDoor = false;
            if (portalId >= 0) {
                const door = p.map.doors[portalId];
                // FIX: `portalId` was only checked as a valid index into the
                // CURRENT map's doors array -- it names one specific real
                // door, but that door's own destination (`door.tmap`, set
                // in map.js's _getDoors) was never cross-checked against the
                // client-supplied `mapId` this handler otherwise trusts.
                // Nor was the door's level gate (`door.minLevel`/
                // `door.maxLevel`, also set in _getDoors) ever enforced. A
                // client could pick any valid door index on their current
                // map and pair it with any other ready map's id to land at
                // that door's tx/ty on an arbitrary destination map,
                // bypassing whatever level requirement that door was
                // configured with. Both are cheap, well-defined checks
                // against data the door object already carries.
                if (door.tmap !== mapId) {
                    console.info("Teleport door does not lead to requested map.");
                    return;
                }
                if (p.level < door.minLevel || p.level > door.maxLevel) {
                    p.sendPlayer(new Messages.Notify("CHAT", "TELEPORT_LEVEL_REQUIRED", [door.minLevel, door.maxLevel]));
                    return;
                }
                if (door.tx >= 0 && door.ty >= 0) {
                    pos = {x: door.tx, y: door.ty};
                    pos.x += (G_TILESIZE >> 1);
                    pos.y += (G_TILESIZE >> 1);
                    isDoor = true;
                }
            }

            p.setMap(map);

// TODO - Going through portal when returning its looping.


            if (!isDoor) {
                pos = p.map.getRandomStartingPosition();
            }

            p.map.entities.addPlayer(p);

            p.setPosition(pos.x, pos.y);
            p.forceStop();
            p.move([Date.now(),3,1,pos.x,pos.y]);

            self.send([Types.Messages.WC_TELEPORT_MAP, mapId, 1, p.x, p.y, portalId]);
        }
        else if (status === 1) {
            p.mapStatus = 2;

            p.knownIds = [];

            p.setPosition(p.x,p.y);
            p.map.entities.processWho(p);
            p.map.entities.sendNeighbours(p, new Messages.Spawn(p), p);

            self.send([Types.Messages.WC_TELEPORT_MAP, mapId, 2, p.x, p.y, portalId]);
        }
    }

    handleStatAdd(message) {
        const self = this;
        const attribute = parseInt(message[0]),
            points = parseInt(message[1]);
        const p = this.player;

        if (points < 0 || points > p.stats.free)
            return;

        if (attribute <= 0 || attribute > 4)
            return;

        let alterBars = false;
        switch (attribute) {
        case 1:
            p.stats.attack += points;
            break;
        case 2:
            p.stats.defense += points;
            break;
        case 3:
            p.stats.health += points;
            alterBars = true;
            break;
        case 4:
            p.stats.luck += points;
            break;
        }
        p.stats.free -= points;

        if (alterBars) {
            p.setHpMax();
            p.setEpMax();
        }

        this.sendPlayer(new Messages.StatInfo(p));
    }

    handleGold(message) {
        const type = parseInt(message[0]),
            gold = parseInt(message[1]),
            type2 = parseInt(message[2]);

        // FIX: gold[]/modifyGold() live on PlayerItems (player.items), not
        // directly on Player -- every line below threw "not a function"
        // (or read undefined), so bank<->inventory gold transfers were
        // completely broken. Also added a bounds check on type/type2: the
        // two `if (type===X && type2===Y)` branches below only ever fire for
        // the two valid combinations, but nothing stopped an out-of-range
        // type from indexing player.items.gold[type] above with a garbage
        // index (gold only has 2 slots: 0 inventory, 1 bank).
        if (type !== 0 && type !== 1)
            return;

        if (gold < 0)
            return;

        if (gold > 9999999) {
            this.sendPlayer(new Messages.Notify("GOLD","MAX_TRANSFER"));
            return;
        }

        if (gold > this.player.items.gold[type])
        {
            this.sendPlayer(new Messages.Notify("GOLD","INSUFFICIENT_GOLD"));
            return;
        }

        // Transfer to bank.
        if (type===0 && type2===1)
        {
            if (this.player.items.modifyGold(-gold, 0))
                this.player.items.modifyGold(gold, 1);
        }

        // Withdraw from bank.
        if (type===1 && type2===0)
        {
            if (this.player.items.modifyGold(-gold, 1))
                this.player.items.modifyGold(gold, 0);
        }
    }

    handleBlock(msg) {
        let type = parseInt(msg[0]),
            id = parseInt(msg[1]),
            x = parseInt(msg[2]),
            y = parseInt(msg[3]);

        const p = this.player;

        const block = p.map.entities.getEntityById(id);
        if (!block || !(block instanceof Block))
            return;
        if (!p.isNextTooEntity(block))
            return;

        if (type === 0) // pickup
        {
            p.holdingBlock = block;
        }
        else if (type === 1) //place
        {
            x = Utils.roundTo(x, G_TILESIZE);
            y = Utils.roundTo(y, G_TILESIZE);

            if (p.map.isColliding(x, y))
                return;

            block.setPosition(x, y);
            block.update(this.player);
            p.holdingBlock = null;
        }
        // NOTE: `handleBlock`'s `msg` parameter is the raw [type,id,x,y]
        // packet array, fully consumed by the destructuring at the top of
        // this function. Rather than reuse/overwrite that binding for the
        // outgoing message, it gets its own name (sendMsg) so the incoming
        // packet param and the outgoing message being built are never the
        // same variable.
        const sendMsg = new Messages.BlockModify(block, p.id, type);
        p.map.entities.sendNeighbours(p, sendMsg, p);
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

    handleHarvest(msg) {
        const x=parseInt(msg[0]), y=parseInt(msg[1]);
        this.player.harvest.onHarvest(x,y);
    }

    handleUseNode(msg) {
        const id=parseInt(msg[0]);
        const p = this.player;
        const entity = p.map.entities.getEntityById(id);
        // FIX: any entity id the client has seen was accepted here, not
        // just Node ids -- onHarvestEntity() (playerharvest.js) happened to
        // self-guard for non-Node entities today (entity.isDead/
        // entity.weaponType are simply undefined on them, routing cleanly
        // into the existing "wrong weapon type" abort), but that's an
        // accident of what onHarvestEntity() currently touches, not a real
        // guarantee -- a future change trusting entity.level/entity.setDrops
        // more directly there would turn this into a live crash the same
        // way the untyped target in handleSkill() did. Checking the type
        // here is cheap and makes the real invariant explicit.
        if (entity && entity instanceof Node)
            this.player.harvest.onHarvestEntity(entity);
    }

    handleConfig(msg) {
      const arr = msg[0];
      const p = this.player;

      for (const val of arr) {
        if (p.config.hasOwnProperty(val[0]))
          p.config[ val[0]] = val[1];
      }
    }
}

export default PacketHandler;

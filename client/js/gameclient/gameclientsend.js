// Mixin extracted from gameclient.js: outbound sendXxx() message builders
// (each just packs args into a Types.Messages.* packet and calls sendMessage()).
// Applied onto GameClient.prototype via install*(...) call in gameclient.js; not a standalone class.
/* global Types, Utils */

// REMOVED (packet-validation audit): sendDropItem/sendMapStatus/
// sendSkillLoad/sendDelist referenced Types.Messages constants that don't
// exist in shared/js/gametypes.js's Messages enum (CW_DROP, CW_MAP_STATUS,
// CW_SKILLLOAD, CW_DELIST -- each resolved to `undefined`, which
// packethandler.js's `isNaN(parseInt(message[0]))` check would reject by
// closing the connection), and sendLoot's payload shape didn't match
// CW_LOOT's format.js schema. Checked every caller in client/js (including
// the commented-out sendLoot call in game.js's onStopPathing) -- none of
// these five were ever actually invoked live: real drop-item goes through
// inventoryhandler.js's own sendDropItem() (`sendItemSlot([2, type, slot,
// count])`), map status through sendTeleportMap(), and single-item loot
// through sendLootMove() below. sendColorTint (CW_COLOR_TINT is a real
// type, unlike the four above) was also unused -- gameserver/js/format.js's
// schema for it was already removed for the same reason. Removed all six
// rather than leave dead, unreachable methods for the next person to
// mistake for working code.

export function installGameClientSend(proto) {
    				proto.sendSyncTime = function(date) {
    						log.info("sendSyncTime");
    						this.sendMessage([Types.Messages.BI_SYNCTIME,date]);
    				};

    				proto.sendLoginPlayer = function(playername, playerhash) {
    					this.sendMessage([Types.Messages.CW_LOGIN_PLAYER,
    														playername,
    														playerhash]);
    				};

            proto.sendMoveEntity = function(entity, action) {
                // FIX: leftover unconditional debug logging firing on every single player move;
                // same class of issue already cleaned up elsewhere in this file (see log.debug
                // FIX comments above) - use log.debug so it's gated behind the log level instead
                log.debug("sendMoveEntity: x:"+entity.x+",entity.y:"+entity.y);
                this.sendMessage([Types.Messages.CW_MOVE,
    											Utils.getWorldTime(),
                		      entity.id,
    											action,
    											entity.orientation,
    											entity.x,
    											entity.y]);
            };

            proto.sendMovePath = function(entity, length, path) {
    						const simpath = path;

                const array = [Types.Messages.CW_MOVEPATH,
    											Utils.getWorldTime(),
                		      entity.id,
    											entity.getOrientation(path[0], path[1]),
                          (entity.interrupted ? 1 : 0)];

                array.push(simpath);
            		this.sendMessage(array);
            };

            proto.sendAttack = function(player, mob, spellId) {
                this.sendMessage([Types.Messages.CW_ATTACK, Utils.getWorldTime(),
                                  mob.id, player.orientation, spellId]);
            };

            proto.sendChat = function(text) {
                this.sendMessage([Types.Messages.CW_CHAT,
                                  text]);
            };

    				// map, status, x, y
            proto.sendTeleportMap = function(data) {
                this.sendMessage([Types.Messages.CW_TELEPORT_MAP,
                		      	  		data[0], data[1], data[2], data[3], data[4]]);
            };

            proto.sendWho = function(ids) {
    						this.sendMessage([Types.Messages.CW_WHO,ids]);
            };

    				proto.sendWhoRequest = function() {
    						this.sendMessage([Types.Messages.CW_REQUEST,3]);
            };

            proto.sendTalkToNPC = function(type, npcId) {
                this.sendMessage([Types.Messages.CW_TALKTONPC, type, npcId]);
            };

            proto.sendQuest = function(entityId, questId, status){
                this.sendMessage([Types.Messages.CW_QUEST, entityId, questId, status]);
            };

    				// category, type, inventoryNumber, count, x, y
            proto.sendItemSlot = function(data){
                this.sendMessage([Types.Messages.CW_ITEMSLOT].concat(data));
            };

            proto.sendSkill = function(type, targetId){
                this.sendMessage([Types.Messages.CW_SKILL, type, targetId]);
            };

            proto.sendShortcut = function(index, type, shortcutId) {
                this.sendMessage([Types.Messages.CW_SHORTCUT, index, type, shortcutId]);
            };

            proto.sendStoreSell = function(type, inventoryNumber) {
                this.sendMessage([Types.Messages.CW_STORESELL, type, inventoryNumber]);
            };

            proto.sendStoreBuy = function(itemType, itemKind, itemCount) {
                this.sendMessage([Types.Messages.CW_STOREBUY, itemType, itemKind, itemCount]);
            };

    				proto.sendStoreCraft = function(itemKind, itemCount) {
                this.sendMessage([Types.Messages.CW_CRAFT, itemKind, itemCount]);
            };

    				proto.sendPlayerInfo = function() {
    					this.sendMessage([Types.Messages.CW_REQUEST, 2]);
    				};

            proto.sendAuctionOpen = function(type) {
                this.sendMessage([Types.Messages.CW_AUCTIONOPEN, type]);
            };

            proto.sendAuctionSell = function(inventoryNumber, sellValue) {
                this.sendMessage([Types.Messages.CW_AUCTIONSELL, inventoryNumber, sellValue]);
            };

            proto.sendAuctionBuy = function(index, type) {
                this.sendMessage([Types.Messages.CW_AUCTIONBUY, index, type]);
            };

            proto.sendAuctionDelete = function(index, type) {
                this.sendMessage([Types.Messages.CW_AUCTIONDELETE, index, type]);
            };

            // FIX (comment only, checked -- not a behavior bug): this said "type 1
            // = Inventory, 2 = Equipment", but gameserver's handleStoreModItem
            // (packethandler.js) only accepts type 0 (inventory) or type 2
            // (equipment) -- type 1 would silently no-op (itemStore[1] is bank,
            // not repairable/enchantable via this path). Confirmed every real
            // caller (equipmenthandler.js's repairItem/enchantItem, ultimately
            // fed by inventorydialog.js's `data('itemType', 0 or 2)`) only ever
            // passes 0 or 2, so this never actually misfired -- the comment was
            // just wrong about which number means "inventory".
            proto.sendStoreEnchant = function(type, index) { // type 0 = Inventory, 2 = Equipment.
                this.sendMessage([Types.Messages.CW_STORE_MODITEM, 1, type, index]);
            };

            proto.sendStoreRepair = function(type, index) { // type 0 = Inventory, 2 = Equipment.
                this.sendMessage([Types.Messages.CW_STORE_MODITEM, 0, type, index]);
            };

            proto.sendGold = function(type, amount, type2) {
                this.sendMessage([Types.Messages.CW_GOLD, parseInt(type), parseInt(amount), parseInt(type2)]);
            };

            proto.sendPlayerRevive = function() {
            	this.sendMessage([Types.Messages.CW_REQUEST, 1]);
            };

    				proto.sendAppearanceList = function() {
    					this.sendMessage([Types.Messages.CW_REQUEST, 0]);
    				};

    				proto.sendAppearanceUnlock = function(index, buy) {
    					buy = buy || 0;
    					this.sendMessage([Types.Messages.CW_APPEARANCEUNLOCK, index, buy]);
    				};

    				proto.sendLook = function(type, id) {
    					this.sendMessage([Types.Messages.CW_LOOKUPDATE, type, id]);
    				};

    				proto.sendAddStat = function(statType, points) {
    					this.sendMessage([Types.Messages.CW_STATADD, statType, points]);
    				};

    				proto.sendLootMove = function(item) {
    					this.sendMessage([Types.Messages.CW_LOOT, item.id, item.x, item.y]);
    				};

    				proto.sendBlock = function(type, id, x, y) {
    					this.sendMessage([Types.Messages.CW_BLOCK_MODIFY, type, id, x, y]);
    				};

    				proto.sendPartyInvite = function(name, status) { // 0 for request, 1, for yes, 2 for no.
                this.sendMessage([Types.Messages.CW_PARTY, 1,
                                  name, status]);
            };

    				proto.sendPartyKick = function(name) {
                this.sendMessage([Types.Messages.CW_PARTY, 2,
                                  name, 0]);
            };

    				proto.sendPartyLeader = function(name) {
                this.sendMessage([Types.Messages.CW_PARTY, 3,
                                  name, 0]);
            };

            proto.sendPartyLeave = function() {
                this.sendMessage([Types.Messages.CW_PARTY, 4, '', 0]);
            };

    				proto.sendHarvest = function(x, y) {
                this.sendMessage([Types.Messages.CW_HARVEST, x, y]);
            };

    				proto.sendHarvestEntity = function(entity) {
                this.sendMessage([Types.Messages.CW_USE_NODE, entity.id]);
            };

            proto.sendConfig = function(arr) {
                this.sendMessage([Types.Messages.CW_CONFIG, arr]);
            };

}

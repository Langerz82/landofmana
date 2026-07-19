// Converted from AMD (define) + Class.extend to a native ES6 module/class.
// NOTE: 'lib/pako' and 'lib/bison' remain classic (non-module) <script> globals (`pako`,
// `BISON`), same as jQuery/underscore/PIXI elsewhere, so they are not imported here.
/* global Types, Utils, log, Class, pako, BISON */
import Detect from './detect.js';
import Player from './entity/player.js';
import EntityFactory from './entityfactory.js';
import Mob from './entity/mob.js';
import Item from './entity/item.js';
import MobData from './data/mobdata.js';
import config from './config.js';
import ChatHandler from './chathandler.js';
import Timer from './timer.js';

export default class GameClient {
        constructor() {
					const self = this;

					this.useBison = false;

            this.enable();

            this.tablet = Detect.isTablet(window.innerWidth);
            this.mobile = Detect.isMobile();

            this.handlers = {};

					this.onMessage = function(data) {
	            // FIX: was console.warn'ing every inbound packet unconditionally (including
	            // login-hash payloads) - switched to log.debug, which is already gated behind
	            // the log level (see lib/log.js) so this is silent outside debug builds
	            log.debug("recv: "+data);
							const fnProcessMessage = function (message) {
								if(self.isListening) {
			            if(self.useBison) {
			              data = BISON.decode(message);
			            } else {
			              data = JSON.parse(message);
			            }
	                fnRecieveAction(data);
			          }
							};
	           const fnRecieveAction = function (data) {
	             // FIX: same unconditional logging issue as onMessage above - use log.debug
	             log.debug("recv: "+data);
	             if(data instanceof Array) {
	               if(data[0] instanceof Array) {
	                 // Multiple actions received
	                 self.receiveActionBatch(data);
	               } else {
	                 // Only one action received
	                 self.receiveAction(data);
	               }
	             }
	           };
	           const method = data[0];
		        if (method === '2')
		        {
	            const buffer = Utils._base64ToArrayBuffer(data.substr(1));
	            try {
	              const message = pako.inflate(buffer, {gzip: true, to: 'string'});
								log.debug("message:"+message); // FIX: unconditional console.warn -> log.debug (see onMessage above)
							  fnProcessMessage(message);
	            } catch (err) {
	              // FIX: was silently swallowed via console.log; surface via log.error so
	              // decompress failures are visible/gated the same way as other errors
	              log.error("Failed to decompress server message: " + err);
	            }
		        }
		        else if (method === '1') {
		          const message = data.substr(1);
							fnProcessMessage(message);
		        }
	          else {
	            const message = data.split(",");
	            fnRecieveAction(message);
	          }
		      };
					log.info("Starting client/server handshake");
        }

				setHandlers() {
					this.handlers[Types.Messages.BI_SYNCTIME] = this.onSyncTime;
					this.handlers[Types.Messages.WC_AUCTIONOPEN] = this.auction_callback;
					this.handlers[Types.Messages.WC_CHANGEPOINTS] = this.change_points_callback;
					this.handlers[Types.Messages.WC_CHAT] = this.chat_callback;
					this.handlers[Types.Messages.WC_DAMAGE] = this.dmg_callback;
					// NOTE (packet-validation audit): `Types.Messages.WC_DESTROY` doesn't exist in
					// shared/js/gametypes.js's Messages enum (no server-side sender was found
					// either - grepped gameserver/js for WC_DESTROY/Messages.Destroy, no matches),
					// so this key is `undefined` and always was. `destroy_callback` is also never
					// assigned anywhere (no `client.onDestroy(...)` registration exists in
					// clientcallbacks.js), so this line is inert on both ends - not a live bug, just
					// vestigial dead wiring for a message type that was apparently removed (entity
					// removal is handled via WC_DESPAWN instead). Left in place rather than deleted
					// since there's no live caller to confirm it's safe to remove outright.
					this.handlers[Types.Messages.WC_DESTROY] = this.destroy_callback;
					this.handlers[Types.Messages.WC_GOLD] = this.gold_callback;
					this.handlers[Types.Messages.WC_ITEMSLOT] = this.itemslot_callback;
					this.handlers[Types.Messages.WC_ITEMLEVELUP] = this.itemlevelup_callback;
					this.handlers[Types.Messages.WC_STAT] = this.stat_callback;
					this.handlers[Types.Messages.WC_LEVELUP] = this.levelup_callback;
					this.handlers[Types.Messages.WC_DESPAWN] = this.despawn_callback;
					this.handlers[Types.Messages.WC_APPEARANCE] = this.appearance_callback;
					this.handlers[Types.Messages.WC_MOVE] = this.move_callback;
					this.handlers[Types.Messages.WC_MOVEPATH] = this.movepath_callback;
					this.handlers[Types.Messages.WC_NOTIFY] = this.notify_callback;
					this.handlers[Types.Messages.WC_QUEST] = this.quest_callback;
					this.handlers[Types.Messages.WC_ACHIEVEMENT] = this.achievement_callback;
					this.handlers[Types.Messages.WC_SKILLEFFECTS] = this.skilleffects_callback;
					this.handlers[Types.Messages.WC_SKILLLOAD] = this.skillLoad_callback;
					// FIX (packet-validation audit): this read Types.Messages.WC_SKILLXP, but the
					// shared enum (shared/js/gametypes.js) only defines WC_SKILL_XP (with an
					// underscore) = 332. WC_SKILLXP was undefined, so this line registered
					// skillxp_callback under this.handlers["undefined"] (computed-property access
					// stringifies an undefined key). Every real WC_SKILL_XP=332 packet from the
					// server then found nothing at this.handlers[332] and fell through to
					// receiveAction's "Unknown action" branch - skill-XP-gain packets were silently
					// dropped and skillxp_callback was never invoked from the network. Corrected to
					// match the real constant name.
					this.handlers[Types.Messages.WC_SKILL_XP] = this.skillxp_callback;
					this.handlers[Types.Messages.WC_SPAWN] = this.receiveSpawn;
					this.handlers[Types.Messages.WC_SPEECH] = this.speech_callback;
					this.handlers[Types.Messages.WC_DIALOGUE] = this.dialogue_callback;
					this.handlers[Types.Messages.WC_STATINFO] = this.statInfo_callback;
					this.handlers[Types.Messages.WC_TELEPORT_MAP] = this.teleportmap_callback;
					this.handlers[Types.Messages.WC_BLOCK_MODIFY] = this.block_callback;
					this.handlers[Types.Messages.WC_PARTY] = this.party_callback;
//					this.handlers[Types.Messages.WC_LOOKS] = this.looks_callback;
					this.handlers[Types.Messages.WC_PLAYERINFO] = this.playerinfo_callback;
					this.handlers[Types.Messages.WC_HARVEST] = this.harvest_callback;

					this.handlers[Types.Messages.WC_SET_SPRITE] = this.set_sprite_callback;
					this.handlers[Types.Messages.WC_SET_ANIMATION] = this.set_animation_callback;
					this.handlers[Types.Messages.WC_VERSION] = this.onVersion;
					this.handlers[Types.Messages.WC_PLAYER] = this.player_callback;
					this.handlers[Types.Messages.WC_ERROR] = this.onError;
				}

				connect(url, data) {
					const self = this;

					this.connection = io(url, {
            forceNew: true,
            reconnection: false,
            timeout: 10000,
            transports: ['websocket'],
          });

					this.connection.on('connect', function() {
            log.info("Connected to server "+url);
            self.onConnected(data);
          });

					this.connection.on('message', function(e) {
							self.onMessage(e);
							return false;
					});

					this.connection.on('disconnect', function() {
							log.debug("Connection closed");
							if(self.disconnected_callback) {
									if(self.isTimeout) {
											self._onError(["You have been disconnected for being inactive for too long"]);
									} else {
											self._onError(["The connection to RRO2 has been lost."]);
									}
							}
					});
				}

				onError(data) {
	          const message = data[0];
	          $('#container').addClass('error');
	          // FIX: XSS - server-supplied error message was inserted unescaped via .append(); escape before rendering
	          $('#errorwindow .errordetails').append("<p>"+Utils.escapeHtml(message)+"</p>");
	          app.loadWindow('playerwindow','errorwindow');
						$('#errorwindow').focus();
	      }

				_onError(data) {
	          this.onError(data);
	      }

				onConnected(data) {
					this.sendLoginPlayer(data[0], data[1]);
					this.sendSyncTime(Date.now());
				}

				onVersion(data) {
		        game.onVersionGame(data);
		      }

        enable() {
            this.isListening = true;
        }

        disable() {
            this.isListening = false;
        }


        sendMessage(json) {
          let data;
          if(this.connection.connected === true) {
            // FIX: was console.warn'ing every outbound packet unconditionally, including
            // sendLoginPlayer's playername/hash - use log.debug (gated, see lib/log.js)
          	if(this.useBison) {
                data = BISON.encode(json);
                // PERF: useBison is hardcoded false (see constructor), so this
                // branch never runs today, but keep a working log line for it.
                log.debug("sent=" + JSON.stringify(json));
            } else {
                data = JSON.stringify(json);
                // PERF: this used to call JSON.stringify(json) a second time
                // just to build the log message -- on every single outbound
                // packet (every move/chat/attack/etc). Reuse the string
                // already computed above instead of serializing twice.
                log.debug("sent=" + data);
          	}

						try {
							this.connection.send("1"+data);
						} catch (err) {
							// FIX: was silently swallowed via console.log; surface via log.error
							log.error("Failed to send message: " + err);
						}
          }
        }

        receiveAction(data) {
            const action = data.shift();
            if(this.handlers[action] && _.isFunction(this.handlers[action])) {
                this.handlers[action].call(this, data);
            }
            else {
                log.error("Unknown action : " + action);
            }
        }

        receiveActionBatch(actions) {
            actions.forEach(action => this.receiveAction(action));
        }

        receiveSpawn(data) {
            const id = parseInt(data[0]),
								type = parseInt(data[1]),
                kind = parseInt(data[2]),
								name = data[3].length > 0 ? data[3] : null,
                mapIndex = parseInt(data[4]),
								x = parseInt(data[5]),
								y = parseInt(data[6]);


            // FIX: `mapContainer.ready` is a method (registers a ready callback), not a
            // boolean, so `!game.mapContainer.ready` was always false and this "don't spawn
            // before the map is ready" guard never fired; use the actual boolean flag, as
            // every other readiness check in the codebase does (see game.js/renderer.js)
            if (!game.mapContainer.mapLoaded || game.mapContainer.mapIndex !== parseInt(mapIndex) ||
            	id === game.player.id)
            	return;

						// If Entity exists just re-create it.
            if (game.entityIdExists(id)) {
            	const entity = game.getEntityById(id);
							game.removeEntity(entity);
            }

            if(type === Types.EntityTypes.ITEM || type === Types.EntityTypes.ITEMLOOT) {
                const item = EntityFactory.createEntity(type, kind, id, mapIndex, name);
								item.orientation = parseInt(data[7]);
                item.count = parseInt(data[8]);
								item.setPosition(x, y);
                if(this.spawn_item_callback) {
                    this.spawn_item_callback(data, item); // from 8
                }
						}
            else {
								const level = parseInt(data[8]);
								const entity = EntityFactory.createEntity(type, kind, id, mapIndex, name, level);
								entity.setPosition(x, y);
                if(this.spawn_character_callback) {
                    this.spawn_character_callback(data, entity); // from 6
                }
            }
        }

				onSyncTime(data) {
	        Utils.setWorldTime(parseInt(data[0]), parseInt(data[1]))
	      }

				onParty(callback) {
            this.party_callback = callback;
        }

				onPlayer(callback) {
            this.player_callback = callback;
        }

				onPlayerInfo(callback) {
            this.playerinfo_callback = callback;
        }

        onDispatched(callback) {
            this.dispatched_callback = callback;
        }

        onDisconnected(callback) {
            this.disconnected_callback = callback;
        }

        onLogin(callback) {
        	this.login_callback = callback;
        }

        onSpawnCharacter(callback) {
            this.spawn_character_callback = callback;
        }

        onSpawnItem(callback) {
            this.spawn_item_callback = callback;
        }

        onDespawnEntity(callback) {
            this.despawn_callback = callback;
        }

        onEntityMove(callback) {
            this.move_callback = callback;
        }

        onEntityMovePath(callback) {
            this.movepath_callback = callback;
        }

        onPlayerTeleportMap(callback) {
            this.teleportmap_callback = callback;
        }

        onChatMessage(callback) {
            this.chat_callback = callback;
        }

        onCharacterDamage(callback) {
            this.dmg_callback = callback;
        }

				onPlayerStat(callback) {
            this.stat_callback = callback;
        }

        onPlayerLevelUp(callback) {
            this.levelup_callback = callback;
        }

        onPlayerItemLevelUp(callback) {
            this.itemlevelup_callback = callback;
        }

        onEntityDestroy(callback) {
            this.destroy_callback = callback;
        }

        onCharacterChangePoints(callback) {
            this.change_points_callback = callback;
        }

        onNotify(callback){
            this.notify_callback = callback;
        }

				onDialogue(callback){
            this.dialogue_callback = callback;
        }

        onQuest(callback) {
            this.quest_callback = callback;
        }

				onAchievement(callback) {
            this.achievement_callback = callback;
        }

        onItemSlot(callback) {
            this.itemslot_callback = callback;
        }

        onSkillInstall(callback) {
            this.skillInstall_callback = callback;
        }

        onSkillLoad(callback) {
            this.skillLoad_callback = callback;
        }

				onSkillXP(callback) {
            this.skillxp_callback = callback;
        }

				onSkillEffects(callback) {
            this.skilleffects_callback = callback;
        }

        onStatInfo(callback) {
            this.statInfo_callback = callback;
        }

        onAuction(callback) {
            this.auction_callback = callback;
        }

        onWanted(callback) {
            this.wanted_callback = callback;
        }

        onAggro(callback) {
             this.aggro_callback = callback;
        }

        onSpeech(callback) {
             this.speech_callback = callback;
        }

        onMapStatus(callback) {
        	this.mapstatus_callback = callback;
        }

				onSetSprite(callback) {
					this.set_sprite_callback = callback;
				}

				onSetAnimation(callback) {
					this.set_animation_callback = callback;
				}

				onGold(callback) {
					this.gold_callback = callback;
				}

				onProducts(callback) {
					this.products_callback = callback;
				}

				onAppearance(callback) {
					this.appearance_callback = callback;
				}

				onBlockModify(callback) {
					this.block_callback = callback;
				}

				onHarvest(callback) {
					this.harvest_callback = callback;
				}

// SEND FUNCTIONS.
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
				sendSyncTime(date) {
						log.info("sendSyncTime");
						this.sendMessage([Types.Messages.BI_SYNCTIME,date]);
				}

				sendLoginPlayer(playername, playerhash) {
					this.sendMessage([Types.Messages.CW_LOGIN_PLAYER,
														playername,
														playerhash]);
				}

        sendMoveEntity(entity, action) {
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
        }

        sendMovePath(entity, length, path) {
						const simpath = path;

            const array = [Types.Messages.CW_MOVEPATH,
											Utils.getWorldTime(),
            		      entity.id,
											entity.getOrientation(path[0], path[1]),
                      (entity.interrupted ? 1 : 0)];

            array.push(simpath);
        		this.sendMessage(array);
        }

        sendAttack(player, mob, spellId) {
            this.sendMessage([Types.Messages.CW_ATTACK, Utils.getWorldTime(),
                              mob.id, player.orientation, spellId]);
        }

        sendChat(text) {
            this.sendMessage([Types.Messages.CW_CHAT,
                              text]);
        }

				// map, status, x, y
        sendTeleportMap(data) {
            this.sendMessage([Types.Messages.CW_TELEPORT_MAP,
            		      	  		data[0], data[1], data[2], data[3], data[4]]);
        }

        sendWho(ids) {
						this.sendMessage([Types.Messages.CW_WHO,ids]);
        }

				sendWhoRequest() {
						this.sendMessage([Types.Messages.CW_REQUEST,3]);
        }

        sendTalkToNPC(type, npcId) {
            this.sendMessage([Types.Messages.CW_TALKTONPC, type, npcId]);
        }

        sendQuest(entityId, questId, status){
            this.sendMessage([Types.Messages.CW_QUEST, entityId, questId, status]);
        }

				// category, type, inventoryNumber, count, x, y
        sendItemSlot(data){
            this.sendMessage([Types.Messages.CW_ITEMSLOT].concat(data));
        }

        sendSkill(type, targetId){
            this.sendMessage([Types.Messages.CW_SKILL, type, targetId]);
        }

        sendShortcut(index, type, shortcutId) {
            this.sendMessage([Types.Messages.CW_SHORTCUT, index, type, shortcutId]);
        }

        sendStoreSell(type, inventoryNumber) {
            this.sendMessage([Types.Messages.CW_STORESELL, type, inventoryNumber]);
        }
        sendStoreBuy(itemType, itemKind, itemCount) {
            this.sendMessage([Types.Messages.CW_STOREBUY, itemType, itemKind, itemCount]);
        }
				sendStoreCraft(itemKind, itemCount) {
            this.sendMessage([Types.Messages.CW_CRAFT, itemKind, itemCount]);
        }

				sendPlayerInfo() {
					this.sendMessage([Types.Messages.CW_REQUEST, 2]);
				}

        sendAuctionOpen(type) {
            this.sendMessage([Types.Messages.CW_AUCTIONOPEN, type]);
        }
        sendAuctionSell(inventoryNumber, sellValue) {
            this.sendMessage([Types.Messages.CW_AUCTIONSELL, inventoryNumber, sellValue]);
        }
        sendAuctionBuy(index, type) {
            this.sendMessage([Types.Messages.CW_AUCTIONBUY, index, type]);
        }
        sendAuctionDelete(index, type) {
            this.sendMessage([Types.Messages.CW_AUCTIONDELETE, index, type]);
        }

        // FIX (comment only, checked -- not a behavior bug): this said "type 1
        // = Inventory, 2 = Equipment", but gameserver's handleStoreModItem
        // (packethandler.js) only accepts type 0 (inventory) or type 2
        // (equipment) -- type 1 would silently no-op (itemStore[1] is bank,
        // not repairable/enchantable via this path). Confirmed every real
        // caller (equipmenthandler.js's repairItem/enchantItem, ultimately
        // fed by inventorydialog.js's `data('itemType', 0 or 2)`) only ever
        // passes 0 or 2, so this never actually misfired -- the comment was
        // just wrong about which number means "inventory".
        sendStoreEnchant(type, index) { // type 0 = Inventory, 2 = Equipment.
            this.sendMessage([Types.Messages.CW_STORE_MODITEM, 1, type, index]);
        }
        sendStoreRepair(type, index) { // type 0 = Inventory, 2 = Equipment.
            this.sendMessage([Types.Messages.CW_STORE_MODITEM, 0, type, index]);
        }

        sendGold(type, amount, type2) {
            this.sendMessage([Types.Messages.CW_GOLD, parseInt(type), parseInt(amount), parseInt(type2)]);
        }

        sendPlayerRevive() {
        	this.sendMessage([Types.Messages.CW_REQUEST, 1]);
        }

				sendAppearanceList() {
					this.sendMessage([Types.Messages.CW_REQUEST, 0]);
				}

				sendAppearanceUnlock(index, buy) {
					buy = buy || 0;
					this.sendMessage([Types.Messages.CW_APPEARANCEUNLOCK, index, buy]);
				}

				sendLook(type, id) {
					this.sendMessage([Types.Messages.CW_LOOKUPDATE, type, id]);
				}

				sendAddStat(statType, points) {
					this.sendMessage([Types.Messages.CW_STATADD, statType, points]);
				}

				sendLootMove(item) {
					this.sendMessage([Types.Messages.CW_LOOT, item.id, item.x, item.y]);
				}

				sendBlock(type, id, x, y) {
					this.sendMessage([Types.Messages.CW_BLOCK_MODIFY, type, id, x, y]);
				}

				sendPartyInvite(name, status) { // 0 for request, 1, for yes, 2 for no.
            this.sendMessage([Types.Messages.CW_PARTY, 1,
                              name, status]);
        }

				sendPartyKick(name) {
            this.sendMessage([Types.Messages.CW_PARTY, 2,
                              name, 0]);
        }

				sendPartyLeader(name) {
            this.sendMessage([Types.Messages.CW_PARTY, 3,
                              name, 0]);
        }

        sendPartyLeave() {
            this.sendMessage([Types.Messages.CW_PARTY, 4, '', 0]);
        }

				sendHarvest(x, y) {
            this.sendMessage([Types.Messages.CW_HARVEST, x, y]);
        }

				sendHarvestEntity(entity) {
            this.sendMessage([Types.Messages.CW_USE_NODE, entity.id]);
        }

        sendConfig(arr) {
            this.sendMessage([Types.Messages.CW_CONFIG, arr]);
        }
}

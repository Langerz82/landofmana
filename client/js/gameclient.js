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
					this.handlers[Types.Messages.WC_SKILLXP] = this.skillxp_callback;
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

					//this.connection.removeListener('message', userclient.onMessage);
					this.connection.on('message', function(e) {
							//console.warn("recv="+e);
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

        //connect: function() {
        //},

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
            //log.info("recieved=" + JSON.stringify(data));
            const action = data.shift();
            if(this.handlers[action] && _.isFunction(this.handlers[action])) {
                this.handlers[action].call(this, data);
            }
            else {
                log.error("Unknown action : " + action);
            }
        }

        receiveActionBatch(actions) {
            const self = this;
            _.each(actions, function(action) {
                self.receiveAction(action);
                //self.packets.push(action);
                //log.info(JSON.stringify(action));
            });
        }

        receiveSpawn(data) {
            const id = parseInt(data[0]),
								type = parseInt(data[1]),
                kind = parseInt(data[2]),
								name = data[3].length > 0 ? data[3] : null,
                mapIndex = parseInt(data[4]),
								x = parseInt(data[5]),
								y = parseInt(data[6]);

            //log.info("game.mapIndex:"+game.mapIndex);
            //log.info("map:"+parseInt(map));

            // FIX: `mapContainer.ready` is a method (registers a ready callback), not a
            // boolean, so `!game.mapContainer.ready` was always false and this "don't spawn
            // before the map is ready" guard never fired; use the actual boolean flag, as
            // every other readiness check in the codebase does (see game.js/renderer.js)
            if (!game.mapContainer.mapLoaded || game.mapContainer.mapIndex !== parseInt(mapIndex) ||
            	id === game.player.id)
            	return;

            //log.info("data="+JSON.stringify(data));
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

				sendDropItem(item, x, y) {
					this.sendMessage([Types.Messages.CW_DROP,
														x,
														y,
														item.id]);
				}

        sendAttack(player, mob, spellId) {
            this.sendMessage([Types.Messages.CW_ATTACK, Utils.getWorldTime(),
                              mob.id, player.orientation, spellId]);
        }

        sendChat(text) {
            this.sendMessage([Types.Messages.CW_CHAT,
                              text]);
        }

        sendLoot(item) {
            this.sendMessage([Types.Messages.CW_LOOT].concat(_.pluck(item,'id')));
        }

				// map, status, x, y
        sendTeleportMap(data) {
						//if (data[1] === 0)
							//game.renderer.blankFrame = true;
            this.sendMessage([Types.Messages.CW_TELEPORT_MAP,
            		      	  		data[0], data[1], data[2], data[3], data[4]]);
        }

        sendWho(ids) {
						this.sendMessage([Types.Messages.CW_WHO,ids]);
        }

				sendWhoRequest() {
						this.sendMessage([Types.Messages.CW_REQUEST,3]);
        }

        sendDelist(ids) {
            ids.unshift(Types.Messages.CW_DELIST);
            this.sendMessage(ids);
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

        sendSkillLoad() {
            this.sendMessage([Types.Messages.CW_SKILLLOAD]);
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

        sendStoreEnchant(type, index) { // type 1 = Inventory, 2 = Equipment.
            this.sendMessage([Types.Messages.CW_STORE_MODITEM, 1, type, index]);
        }
        sendStoreRepair(type, index) { // type 1 = Inventory, 2 = Equipment.
            this.sendMessage([Types.Messages.CW_STORE_MODITEM, 0, type, index]);
        }

        sendGold(type, amount, type2) {
            this.sendMessage([Types.Messages.CW_GOLD, parseInt(type), parseInt(amount), parseInt(type2)]);
        }

        sendMapStatus(mapId, status) {
        	this.sendMessage([Types.Messages.CW_MAP_STATUS, mapId, status]);
        }
        sendPlayerRevive() {
        	this.sendMessage([Types.Messages.CW_REQUEST, 1]);
        }
        sendColorTint(type, value) {
        	this.sendMessage([Types.Messages.CW_COLOR_TINT, type, value]);
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

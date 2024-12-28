
/* global Types, log, Class */

define(['lib/pako', 'entity/player', 'entityfactory', 'entity/mob', 'entity/item', 'data/mobdata', 'lib/bison', 'config', 'chathandler', 'timer', 'util'],
	function(pako, Player, EntityFactory, Mob, Item, MobData, BISON, config, ChatHandler, Timer) {

    var GameClient = Class.extend({
        init: function() {
						var self = this;

						this.useBison = false;

            this.enable();

            this.tablet = Detect.isTablet(window.innerWidth);
            this.mobile = Detect.isMobile();


						//this.harvest_callback	= null;
            this.handlers = {};

						//this.rawpackets = [];
						//this.packets = [];

		        var burst = 4;

						self.onMessage = function(data) {
	            console.warn("recv: "+data);
							var fnProcessMessage = function (message) {
								if(self.isListening) {
			            if(self.useBison) {
			              data = BISON.decode(message);
			            } else {
			              data = JSON.parse(message);
			            }
	                fnRecieveAction(data);
			          }
							};
	           var fnRecieveAction = function (data) {
	             console.warn("recv: "+data);
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
	           var method = data.substr(0,2);
		        if (method === 'z|')
		        {
	            var buffer = _base64ToArrayBuffer(data.substr(2));
	            try {
	              var message = pako.inflate(buffer, {gzip: true, to: 'string'});
								console.warn("message:"+message);
							  fnProcessMessage(message);
	            } catch (err) {
	              console.log(err);
	            }
		        }
		        else if (method === '1[') {
		          var message = data.substr(1);
							fnProcessMessage(message);
		        }
	          else {
	            var message = data.split(",");
	            fnRecieveAction(message);
	          }
		      };
		      /*this.packetProcFunc = function() {
		        if (!self.packets || self.packets.length == 0)
		          return;
		        for (var i=0; i < burst; ++i)
		        {
		            if (self.packets.length == 0)
		              return;
		            var data = self.packets.shift();
		            log.info("recv: "+data);
		            self.receiveAction(data);
		        }
		      };*/

					//setInterval(function () { self.packetProcFunc(); }, 16);

					log.info("Starting client/server handshake");
        },

				setHandlers: function () {
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
					this.handlers[Types.Messages.WC_SWAPSPRITE] = this.swapsprite_callback;
					this.handlers[Types.Messages.WC_APPEARANCE] = this.appearance_callback;
					//this.handlers[Types.Messages.WC_LOOKUPDATE] = this.updatelook_calllback;
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
					this.handlers[Types.Messages.WC_LOOKS] = this.looks_callback;
					this.handlers[Types.Messages.WC_PLAYERINFO] = this.playerinfo_callback;
					this.handlers[Types.Messages.WC_HARVEST] = this.harvest_callback;

					this.handlers[Types.Messages.WC_SET_SPRITE] = this.set_sprite_callback;
					this.handlers[Types.Messages.WC_SET_ANIMATION] = this.set_animation_callback;
					this.handlers[Types.Messages.WC_VERSION] = this.onVersion;
					this.handlers[Types.Messages.WC_PLAYER] = this.player_callback;
				},

				connect: function (url, data) {
					var self = this;

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
				},

				_onError: function (data) {
	          var message = data[0];
	          $('#container').addClass('error');
	          $('#errorwindow .errordetails').html("<p>"+message+"</p>");
	          app.loadWindow('playerwindow','errorwindow');
	      },

				onConnected: function (data) {
					this.sendLoginPlayer(data[0], data[1]);
					this.sendSyncTime();
				},

				onVersion: function (data) {
	        game.onVersionGame(data);
	      },

        enable: function() {
            this.isListening = true;
        },

        disable: function() {
            this.isListening = false;
        },

        //connect: function() {
        //},

        sendMessage: function(json) {
          var data;
          if(this.connection.connected === true) {
            //console.warn("sent=" + JSON.stringify(json));
          	if(this.useBison) {
                data = BISON.encode(json);
            } else {
                data = JSON.stringify(json);
          	}

						try {
							this.connection.send("1"+data);
						} catch (err) {
							console.log(err);
						}
          }
        },

        /*receiveMessage: function(incomingData) {
            var self = this;
            self.rawpackets.push(incomingData);
        },*/

        receiveAction: function(data) {
            //log.info("recieved=" + JSON.stringify(data));
            var action = data.shift();
            if(this.handlers[action] && _.isFunction(this.handlers[action])) {
                this.handlers[action].call(this, data);
            }
            else {
                log.error("Unknown action : " + action);
            }
        },

        receiveActionBatch: function(actions) {
            var self = this;
            _.each(actions, function(action) {
                self.receiveAction(action);
                //self.packets.push(action);
                //log.info(JSON.stringify(action));
            });
        },

        receiveSpawn: function(data) {
            var id = parseInt(data[0]),
								type = parseInt(data[1]),
                kind = parseInt(data[2]),
								name = data[3].length > 0 ? data[3] : null,
                mapIndex = parseInt(data[4]),
								x = parseInt(data[5]),
								y = parseInt(data[6]);

            //log.info("game.mapIndex:"+game.mapIndex);
            //log.info("map:"+parseInt(map));

            if (!game.mapContainer.ready || game.mapContainer.mapIndex != parseInt(mapIndex) ||
            	id == game.player.id)
            	return;

            //log.info("data="+JSON.stringify(data));
						// If Entity exists just re-create it.
            if (game.entityIdExists(id)) {
            	var entity = game.getEntityById(id);
							game.removeEntity(entity);
            }

            if(type == Types.EntityTypes.ITEM || type == Types.EntityTypes.ITEMLOOT) {
                var item = EntityFactory.createEntity(type, kind, id, mapIndex, name);
								item.orientation = parseInt(data[7]);
                item.count = parseInt(data[8]);
								item.setPosition(x, y);
                if(this.spawn_item_callback) {
                    this.spawn_item_callback(data, item); // from 8
                }
						}
            else if(type == Types.EntityTypes.CHEST) {
                var item = EntityFactory.createEntity(type, kind, id, mapIndex, name);
								item.setPosition(x, y);
                if(this.spawn_chest_callback) {
                    this.spawn_chest_callback(data, item); // from 8
                }
								return;
            } else {
								var level = parseInt(data[8]);
								var entity = EntityFactory.createEntity(type, kind, id, mapIndex, name, level);
								entity.setPosition(x, y);
                if(this.spawn_character_callback) {
                    this.spawn_character_callback(data, entity); // from 6
                }
            }
        },

				onVersion: function (data) {
	        game.onVersionGame(data);
	      },

				onParty: function (callback) {
            this.party_callback = callback;
        },

				onLooks: function (callback) {
            this.looks_callback = callback;
        },

				onPlayer: function (callback) {
            this.player_callback = callback;
        },

				onPlayerInfo: function (callback) {
            this.playerinfo_callback = callback;
        },

        onDispatched: function(callback) {
            this.dispatched_callback = callback;
        },

        onDisconnected: function(callback) {
            this.disconnected_callback = callback;
        },

        /*onClientError: function(callback) {
            this.clienterror_callback = callback;
        },*/

        onLogin: function(callback) {
        	this.login_callback = callback;
        },

        onSpawnCharacter: function(callback) {
            this.spawn_character_callback = callback;
        },

        onSpawnItem: function(callback) {
            this.spawn_item_callback = callback;
        },

        onSpawnChest: function(callback) {
            this.spawn_chest_callback = callback;
        },

        onDespawnEntity: function(callback) {
            this.despawn_callback = callback;
        },

        onEntityMove: function(callback) {
            this.move_callback = callback;
        },

        onEntityMovePath: function(callback) {
            this.movepath_callback = callback;
        },

        /*onEntityAttack: function(callback) {
            this.attack_callback = callback;
        },*/

        /*onPlayerChangeHealth: function(callback) {
            this.health_callback = callback;
        },*/

        /*onPlayerEquipItem: function(callback) {
            this.equip_callback = callback;
        },*/

        /*onPlayerMoveToItem: function(callback) {
            this.lootmove_callback = callback;
        },*/

        onPlayerTeleportMap: function(callback) {
            this.teleportmap_callback = callback;
        },

        onChatMessage: function(callback) {
            this.chat_callback = callback;
        },

        /*onDropItem: function(callback) {
            this.drop_callback = callback;
        },*/

        onCharacterDamage: function(callback) {
            this.dmg_callback = callback;
        },

        /*onPlayerKillMob: function(callback) {
            this.kill_callback = callback;
        },*/

				onPlayerStat: function(callback) {
            this.stat_callback = callback;
        },

        onPlayerLevelUp: function(callback) {
            this.levelup_callback = callback;
        },

        onPlayerItemLevelUp: function(callback) {
            this.itemlevelup_callback = callback;
        },

        /*onPopulationChange: function(callback) {
            this.population_callback = callback;
        },*/

        /*onEntityList: function(callback) {
            this.list_callback = callback;
        },*/

				/*onKnownEntityList: function(callback) {
            this.known_callback = callback;
        },*/

        onEntityDestroy: function(callback) {
            this.destroy_callback = callback;
        },

        onCharacterChangePoints: function(callback) {
            this.change_points_callback = callback;
        },

        onNotify: function(callback){
            this.notify_callback = callback;
        },

				onDialogue: function(callback){
            this.dialogue_callback = callback;
        },

        /*onBarStats: function(callback) {
            this.barstats_callback = callback;
        },*/

        onQuest: function(callback) {
            this.quest_callback = callback;
        },

				onAchievement: function(callback) {
            this.achievement_callback = callback;
        },

        /*onTalkToNPC: function(callback) {
            this.talkToNPC_callback = callback;
        },*/

        onItemSlot: function(callback) {
            this.itemslot_callback = callback;
        },

        onSkillInstall: function(callback) {
            this.skillInstall_callback = callback;
        },
        onSkillLoad: function(callback) {
            this.skillLoad_callback = callback;
        },
				onSkillXP: function(callback) {
            this.skillxp_callback = callback;
        },
				onSkillEffects: function (callback) {
            this.skilleffects_callback = callback;
        },

        onStatInfo: function(callback) {
            this.statInfo_callback = callback;
        },

        onAuction: function (callback) {
            this.auction_callback = callback;
        },

        onWanted: function (callback) {
            this.wanted_callback = callback;
        },

        onAggro: function (callback) {
             this.aggro_callback = callback;
        },

        onSpeech: function (callback) {
             this.speech_callback = callback;
        },

        onMapStatus: function (callback) {
        	this.mapstatus_callback = callback;
        },

        /*onUpdateLook: function (callback) {
        	this.updatelook_calllback = callback;
        },*/

				onSetSprite: function (callback) {
					this.set_sprite_callback = callback;
				},

				onSetAnimation: function (callback) {
					this.set_animation_callback = callback;
				},

				onGold: function(callback) {
					this.gold_callback = callback;
				},

				onProducts: function (callback) {
					this.products_callback = callback;
				},

				onSwapSprite: function (callback) {
					this.swapsprite_callback = callback;
				},

				onAppearance: function (callback) {
					this.appearance_callback = callback;
				},

				onBlockModify: function (callback) {
					this.block_callback = callback;
				},

				onHarvest: function (callback) {
					this.harvest_callback = callback;
				},

// SEND FUNCTIONS.
				sendSyncTime: function() {
						log.info("sendSyncTime");
						this.sendMessage([Types.Messages.BI_SYNCTIME,Date.now()]);
				},

				sendLoginPlayer: function (playername, playerhash) {
					this.sendMessage([Types.Messages.CW_LOGIN_PLAYER,
														playername,
														playerhash]);
				},

        /*sendCreate: function(player) {
            this.sendMessage([Types.Messages.CW_CREATE_PLAYER,
															Date.now(),
                              player.name,
            		      				player.pClass
														  ]);
        },

        sendLogin: function(player) {
            this.sendMessage([Types.Messages.CW_LOGIN_PLAYER,
															Date.now(),
                              player.name]);
        },*/

        sendMoveEntity: function(entity, action) {
						//try { throw new Error(); } catch(err) { console.error(err.stack); }
						console.info("DEBUG: sendMoveEntity: x:"+entity.x+",entity.y:"+entity.y);
            this.sendMessage([Types.Messages.CW_MOVE,
											getWorldTime(),
            		      entity.id,
											action,
											entity.orientation,
											entity.x,
											entity.y]);
        },

        sendMovePath: function(entity, length, path) {
						var simpath = path;
						if (entity.followingMode)
						{
							simpath.pop();
							length--;
						}

            var array = [Types.Messages.CW_MOVEPATH,
											getWorldTime(),
            		      entity.id,
											entity.getOrientation(path[0], path[1]),
                      (entity.interrupted ? 1 : 0)];

            array.push(simpath);
        		this.sendMessage(array);
        },

				sendDropItem: function(item, x, y) {
					this.sendMessage([Types.Messages.CW_DROP,
														x,
														y,
														item.id]);
				},

        sendAttack: function(player, mob, spellId) {
            this.sendMessage([Types.Messages.CW_ATTACK, getWorldTime(),
                              mob.id, player.orientation, spellId]);
        },

        sendChat: function(text) {
            this.sendMessage([Types.Messages.CW_CHAT,
                              text]);
        },

        sendLoot: function(item) {
            this.sendMessage([Types.Messages.CW_LOOT].concat(_.pluck(item,'id')));
        },

				// map, status, x, y
        sendTeleportMap: function(data) {
						//if (data[1] == 0)
							//game.renderer.blankFrame = true;
            this.sendMessage([Types.Messages.CW_TELEPORT_MAP,
            		      	  		data[0], data[1], data[2], data[3]]);
        },

        sendWho: function(ids) {
						this.sendMessage([Types.Messages.CW_WHO,ids]);
        },

				sendWhoRequest: function() {
						this.sendMessage([Types.Messages.CW_REQUEST,3]);
        },

        sendDelist: function(ids) {
            ids.unshift(Types.Messages.CW_DELIST);
            this.sendMessage(ids);
        },

        sendTalkToNPC: function (type, npcId) {
            this.sendMessage([Types.Messages.CW_TALKTONPC, type, npcId]);
        },

        sendQuest: function(entityId, questId, status){
            this.sendMessage([Types.Messages.CW_QUEST, entityId, questId, status]);
        },

				// category, type, inventoryNumber, count, x, y
        sendItemSlot: function(data){
            this.sendMessage([Types.Messages.CW_ITEMSLOT].concat(data));
        },

        sendSkill: function(type, targetId){
            this.sendMessage([Types.Messages.CW_SKILL, type, targetId]);
        },

        sendShortcut: function(index, type, shortcutId) {
            this.sendMessage([Types.Messages.CW_SHORTCUT, index, type, shortcutId]);
        },

        sendSkillLoad: function() {
            this.sendMessage([Types.Messages.CW_SKILLLOAD]);
        },

        /*sendCharacterInfo: function() {
            this.sendMessage([Types.Messages.CW_CHARACTERINFO]);
        },*/

        sendStoreSell: function(type, inventoryNumber) {
            this.sendMessage([Types.Messages.CW_STORESELL, type, inventoryNumber]);
        },
        sendStoreBuy: function(itemType, itemKind, itemCount) {
            this.sendMessage([Types.Messages.CW_STOREBUY, itemType, itemKind, itemCount]);
        },
				sendStoreCraft: function(itemKind, itemCount) {
            this.sendMessage([Types.Messages.CW_CRAFT, itemKind, itemCount]);
        },

				sendPlayerInfo: function () {
					this.sendMessage([Types.Messages.CW_REQUEST, 2]);
				},

        sendAuctionOpen: function(type) {
            this.sendMessage([Types.Messages.CW_AUCTIONOPEN, type]);
        },
        sendAuctionSell: function(inventoryNumber, sellValue) {
            this.sendMessage([Types.Messages.CW_AUCTIONSELL, inventoryNumber, sellValue]);
        },
        sendAuctionBuy: function(index, type) {
            this.sendMessage([Types.Messages.CW_AUCTIONBUY, index, type]);
        },
        sendAuctionDelete: function(index, type) {
            this.sendMessage([Types.Messages.CW_AUCTIONDELETE, index, type]);
        },

        sendStoreEnchant: function(type, index) { // type 1 = Inventory, 2 = Equipment.
            this.sendMessage([Types.Messages.CW_STORE_MODITEM, 1, type, index]);
        },
        sendStoreRepair: function(type, index) { // type 1 = Inventory, 2 = Equipment.
            this.sendMessage([Types.Messages.CW_STORE_MODITEM, 0, type, index]);
        },

        /*sendBankStore: function(itemSlot) {
            this.sendMessage([Types.Messages.CW_ITEMSLOT, 2, itemSlot]);
        },
        sendBankRetrieve: function(itemSlot) {
            this.sendMessage([Types.Messages.CW_BANKRETRIEVE, itemSlot]);
        },*/
        sendGold: function(type, amount, type2) {
            this.sendMessage([Types.Messages.CW_GOLD, parseInt(type), parseInt(amount), parseInt(type2)]);
        },

        sendMapStatus: function (mapId, status) {
        	this.sendMessage([Types.Messages.CW_MAP_STATUS, mapId, status]);
        },
        sendPlayerRevive: function () {
        	this.sendMessage([Types.Messages.CW_REQUEST, 1]);
        },
        sendColorTint: function(type, value) {
        	this.sendMessage([Types.Messages.CW_COLOR_TINT, type, value]);
        },

				sendAppearanceList: function() {
					this.sendMessage([Types.Messages.CW_REQUEST, 0]);
				},

				sendAppearanceUnlock: function(index, buy) {
					buy = buy || 0;
					this.sendMessage([Types.Messages.CW_APPEARANCEUNLOCK, index, buy]);
				},

				sendLook: function (type, id) {
					this.sendMessage([Types.Messages.CW_LOOKUPDATE, type, id]);
				},

				sendAddStat: function(statType, points) {
					this.sendMessage([Types.Messages.CW_STATADD, statType, points]);
				},

				sendLootMove: function (item) {
					this.sendMessage([Types.Messages.CW_LOOT, item.id, item.x, item.y]);
				},

				sendBlock: function (type, id, x, y) {
					this.sendMessage([Types.Messages.CW_BLOCK_MODIFY, type, id, x, y]);
				},

				sendPartyInvite: function(name, status) { // 0 for request, 1, for yes, 2 for no.
            this.sendMessage([Types.Messages.CW_PARTY, 1,
                              name, status]);
        },

				sendPartyKick: function(name) {
            this.sendMessage([Types.Messages.CW_PARTY, 2,
                              name, 0]);
        },

				sendPartyLeader: function(name) {
            this.sendMessage([Types.Messages.CW_PARTY, 3,
                              name, 0]);
        },

        sendPartyLeave: function() {
            this.sendMessage([Types.Messages.CW_PARTY, 4, '', 0]);
        },

				sendHarvest: function(x, y) {
            this.sendMessage([Types.Messages.CW_HARVEST, x, y]);
        },

				sendHarvestEntity: function(entity) {
            this.sendMessage([Types.Messages.CW_USE_NODE, entity.id]);
        },


  });
  return GameClient;
});

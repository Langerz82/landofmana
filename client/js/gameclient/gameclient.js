// Converted from AMD (define) + Class.extend to a native ES6 module/class.
// NOTE: 'lib/pako' and 'lib/bison' remain classic (non-module) <script> globals (`pako`,
// `BISON`), same as jQuery/underscore/PIXI elsewhere, so they are not imported here.
/* global Types, Utils, log, Class, pako, BISON */
import Detect from '../detect.js';
import Player from '../entity/player/player.js';
import EntityFactory from '../entityfactory.js';
import Mob from '../entity/mob.js';
import Item from '../entity/item.js';
import MobData from '../data/mobdata.js';
import config from '../config.js';
import ChatHandler from '../chathandler/chathandler.js';
import Timer from '../timer.js';

// GameClient's own behavior is split across these mixin modules for readability
// (gameclient.js had grown to ~662 lines). Each install* call below merges plain-
// function methods onto GameClient.prototype; they're not subclasses/separate
// instances, just GameClient's own methods living in separate files.
import { installGameClientCallbacks } from './gameclientcallbacks.js';
import { installGameClientSend } from './gameclientsend.js';

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

}

installGameClientCallbacks(GameClient.prototype);
installGameClientSend(GameClient.prototype);

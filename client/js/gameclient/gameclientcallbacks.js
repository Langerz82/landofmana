// Mixin extracted from gameclient.js: callback-registration setters used by
// clientcallbacks.js and friends to hook into inbound server events
// (onParty, onChatMessage, onEntityMove, etc.) -- each just stashes the
// callback on the instance for receiveAction()/setHandlers() to invoke later.
// Applied onto GameClient.prototype via install*(...) call in gameclient.js; not a standalone class.

export function installGameClientCallbacks(proto) {
    				proto.onParty = function(callback) {
                this.party_callback = callback;
            };

    				proto.onPlayer = function(callback) {
                this.player_callback = callback;
            };

    				proto.onPlayerInfo = function(callback) {
                this.playerinfo_callback = callback;
            };

            proto.onDispatched = function(callback) {
                this.dispatched_callback = callback;
            };

            proto.onDisconnected = function(callback) {
                this.disconnected_callback = callback;
            };

            proto.onLogin = function(callback) {
            	this.login_callback = callback;
            };

            proto.onSpawnCharacter = function(callback) {
                this.spawn_character_callback = callback;
            };

            proto.onSpawnItem = function(callback) {
                this.spawn_item_callback = callback;
            };

            proto.onDespawnEntity = function(callback) {
                this.despawn_callback = callback;
            };

            proto.onEntityMove = function(callback) {
                this.move_callback = callback;
            };

            proto.onEntityMovePath = function(callback) {
                this.movepath_callback = callback;
            };

            proto.onPlayerTeleportMap = function(callback) {
                this.teleportmap_callback = callback;
            };

            proto.onChatMessage = function(callback) {
                this.chat_callback = callback;
            };

            proto.onCharacterDamage = function(callback) {
                this.dmg_callback = callback;
            };

    				proto.onPlayerStat = function(callback) {
                this.stat_callback = callback;
            };

            proto.onPlayerLevelUp = function(callback) {
                this.levelup_callback = callback;
            };

            proto.onPlayerItemLevelUp = function(callback) {
                this.itemlevelup_callback = callback;
            };

            proto.onEntityDestroy = function(callback) {
                this.destroy_callback = callback;
            };

            proto.onCharacterChangePoints = function(callback) {
                this.change_points_callback = callback;
            };

            proto.onNotify = function(callback){
                this.notify_callback = callback;
            };

    				proto.onDialogue = function(callback){
                this.dialogue_callback = callback;
            };

            proto.onQuest = function(callback) {
                this.quest_callback = callback;
            };

    				proto.onAchievement = function(callback) {
                this.achievement_callback = callback;
            };

            proto.onItemSlot = function(callback) {
                this.itemslot_callback = callback;
            };

            proto.onSkillInstall = function(callback) {
                this.skillInstall_callback = callback;
            };

            proto.onSkillLoad = function(callback) {
                this.skillLoad_callback = callback;
            };

    				proto.onSkillXP = function(callback) {
                this.skillxp_callback = callback;
            };

    				proto.onSkillEffects = function(callback) {
                this.skilleffects_callback = callback;
            };

            proto.onStatInfo = function(callback) {
                this.statInfo_callback = callback;
            };

            proto.onAuction = function(callback) {
                this.auction_callback = callback;
            };

            proto.onWanted = function(callback) {
                this.wanted_callback = callback;
            };

            proto.onAggro = function(callback) {
                 this.aggro_callback = callback;
            };

            proto.onSpeech = function(callback) {
                 this.speech_callback = callback;
            };

            proto.onMapStatus = function(callback) {
            	this.mapstatus_callback = callback;
            };

    				proto.onSetSprite = function(callback) {
    					this.set_sprite_callback = callback;
    				};

    				proto.onSetAnimation = function(callback) {
    					this.set_animation_callback = callback;
    				};

    				proto.onGold = function(callback) {
    					this.gold_callback = callback;
    				};

    				proto.onProducts = function(callback) {
    					this.products_callback = callback;
    				};

    				proto.onAppearance = function(callback) {
    					this.appearance_callback = callback;
    				};

    				proto.onBlockModify = function(callback) {
    					this.block_callback = callback;
    				};

    				proto.onHarvest = function(callback) {
    					this.harvest_callback = callback;
    				};

}

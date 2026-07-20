// Mixin extracted from game.js: HUD/callback plumbing: onGameStart/onPlayerDeath/etc callback registration, resize, updateBars/updateExpBar, showNotification, say, respawnPlayer.
// Applied onto Game.prototype via install*(...) call in game.js; not a standalone class.
/* global Types, lang, game */

export function installGameUI(proto) {
        proto.say = function(message) {
            //All commands must be handled server sided.
            if(!this.chathandler.processSendMessage(message)){
                this.client.sendChat(message);
            }

        };

        proto.respawnPlayer = function() {
            log.debug("Beginning respawn");

            this.player.revive();

            this.updateBars();

            this.initPlayer(true);

            this.started = true;
            this.client.sendPlayerRevive();

            log.debug("Finished respawn");
        };

        proto.onGameStart = function(callback) {
            this.gamestart_callback = callback;
        };

        proto.onClientError = function(callback) {
            this.clienterror_callback = callback;
        };

        proto.onDisconnect = function(callback) {
            this.disconnect_callback = callback;
        };

        proto.onPlayerDeath = function(callback) {
            this.playerdeath_callback = callback;
        };

        proto.onUpdateTarget = function(callback){
            this.updatetarget_callback = callback;
        };

        proto.onPlayerExpChange = function(callback){
            this.playerexp_callback = callback;
        };

        proto.onPlayerHealthChange = function(callback) {
            this.playerhp_callback = callback;
        };

        proto.onBarStatsChange = function(callback) {
            this.barstats_callback = callback;
        };

        proto.onPlayerHurt = function(callback) {
            this.playerhurt_callback = callback;
        };

        proto.onNotification = function(callback) {
            this.notification_callback = callback;
        };

        proto.resize = function(zoomMod) {
            this.renderer.resizeCanvases(zoomMod);
            this.updateBars();
            this.updateExpBar();

            this.inventoryDialog.refreshInventory();
            if (this.storeDialog.visible)
            	this.storeDialog.rescale();
            if (this.bankDialog.visible) {
            	this.bankDialog.rescale();
            }
        };

        proto.updateBars = function() {
            const p = this.player;
            if(p && this.playerhp_callback) {
                this.playerhp_callback(p.stats.hp, p.stats.hpMax);
            }
        };

        proto.updateExpBar = function(){
            if(this.player && this.playerexp_callback){
                const exp = this.player.stats.exp.base;
                const level = Types.getLevel(exp);
                this.playerexp_callback(level, exp);
            }
        };

        proto.showNotification = function(data) {
            const group = data.shift();
            const text = data.shift();

            let message = lang.data[text];
            if (message && data.length > 0)
              message = lang.data[text].format(data);

            if (group.indexOf("GLOBAL") === 0)
            {
              message = text;
              game.renderer.pushAnnouncement(message,10000);
              return;
            }

            if (group.indexOf("NOTICE") === 0)
            {
              game.renderer.pushAnnouncement(message,10000);
              return;
            }

            if (group.indexOf('SHOP') === 0 ||
                group.indexOf('INVENTORY') === 0)
            {
              if(this.craftDialog.visible) {
                  game.notifyDialog.notify(message);
              }
              else if(this.storeDialog.visible) {
                  game.notifyDialog.notify(message);
              } else if(this.auctionDialog.visible) {
                  game.notifyDialog.notify(message);
              } else if(this.appearanceDialog.visible) {
                  if (group.indexOf('SHOP') === 0) {
                  	game.notifyDialog.notify(message);
                  }
              }
            }
            this.chathandler.addNotification(message);
        };

}

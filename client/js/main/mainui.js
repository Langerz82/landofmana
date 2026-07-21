// Extracted from main.js: toolbar button wiring (inventory/character/skill/quest/settings/
// warp/social/achievement/store Button2 instances and their onClick handlers).
// Called once from main.js's initGame(); reads/writes the same bare `game`/`app` globals
// every other file in this codebase uses (see globalstate.js), not passed as parameters.
import Button2 from '../button2.js';
/* global game, app */

export function installMainUI() {
    const self = app;
    app.scale = game.renderer.getScaleFactor();

    Button2.configure = {background: {top: self.scale * 0, width: self.scale * 0}, kinds: [0, 3, 2]};



    // Inventory Button
    self.inventoryButton = new Button2('#inventory', {background: {left: 0, top: 32}});
    self.inventoryButton.onClick(function(sender, event) {
      if(game && game.ready) {
        game.inventoryDialog.toggleInventory();
      }
    });

    // Character Button
    self.statButton = new Button2('#character', {background: {left: 4*32 }});
    self.statButton.onClick(function(sender, event) {
        app.toggleCharacter();
    });
    game.statDialog.button = self.statButton;
    app.toggleCharacter = function() {
  				if(game && game.ready) {
  					game.statDialog.show();
  				}
    };

    // Skill button
    self.skillButton = new Button2('#skill', {background: {left: 96 }});
    self.skillButton.onClick(function(sender, event) {
        app.toggleSkill();
    });
    app.toggleSkill = function() {
  				if(game && game.ready) {
  					game.skillDialog.show();
  				}
    };

    // Quest Button
    self.questButton = new Button2('#help', {background: {left: 352}});
    self.questButton.onClick(function(sender, event) {
        game.questhandler.toggleShowLog();
    });

    // Settings Button
    self.settingsButton = new Button2('#settings', {background: {left: 32}, downed: false});
    self.settingsButton.onClick(function(sender, event) {
        game.settingsHandler.show();
    });
    game.settingsButton = self.settingsButton;

    // Warp Button
    self.warpButton = new Button2('#warp', {background: {left: 482}});
    self.warpButton.onClick(function(sender, event) {
        app.toggleWarp();
    });
    game.warpButton = self.warpButton;
    app.toggleWarp = function() {
        if(game && game.ready) {
            game.teleportMaps(0);
        }
    };

	          // Party Button
    self.socialButton = new Button2('#social', {background: {left: 416}});
    self.socialButton.onClick(function(sender, event) {
        app.toggleSocial()
    });
    game.socialButton = self.socialButton;
    app.toggleSocial = function() {
        if(game && game.ready) {
        	game.socialHandler.show();
        }
    }

		      // Leader Button
    self.achievementButton = new Button2('#achievement', {background: {left: 448}});
    self.achievementButton.onClick(function(sender, event) {
        game.achievementHandler.toggleShowLog();
    });
    game.achievementButton = self.achievementButton;

    // Store Button
    self.storeButton = new Button2('#store', {background: {left: 160}});
    self.storeButton.onClick(function(sender, event) {
        app.toggleStore();
    });
    game.storeButton = self.storeButton;
    app.toggleStore = function() {
        if(game && game.ready) {
        	game.storeHandler.show();
        }
    }
}

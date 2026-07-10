// Converted from AMD (define) + top-level bootstrap globals to a native ES6 module.
// 'dialog/dialog' (Dialog) is not referenced directly by identifier anywhere in this file, so it
// is not imported here (consumers that need it already import dialog/dialog.js themselves).
// PIXI, $, console, StatusBar, screen, Types, Utils remain classic (non-module) globals as
// established throughout this conversion (Types/Utils are exposed via js/globaltypes.js, which
// home.js imports before this file).
import App from './app.js';
import LangData from './data/langdata.js';
import Detect from './detect.js';
import Button2 from './button2.js';
import Game from './game.js';

/* global Types, Utils, PIXI, StatusBar, screen */

// FIX (conversion): these were bare top-level assignments relying on non-strict/classic-script
// semantics to create window properties; ES modules are always strict mode and top-level
// var/let/const do NOT create window properties, so they are made explicit here. This is the
// canonical declaration site for these cross-file "global" identifiers (see js/globalstate.js
// for the same pattern applied to DragItem/DragBank/ShortcutData).
window.app = null;
window.log = console;

window.G_LATENCY = 75;
window.G_ROUNDTRIP = window.G_LATENCY * 2;
window.G_UPDATE_INTERVAL = 16;
//G_RENDER_INTERVAL = 16;
window.G_TILESIZE = 16;

window.ATTACK_INTERVAL = 1000;
window.ATTACK_MAX = 1000;

window.Container = {
  "STAGE": new PIXI.Container(),
  "BACKGROUND": new PIXI.Container(),
  "ENTITIES": new PIXI.Container(),
  "FOREGROUND": new PIXI.Container(),
//  COLLISION: new PIXI.Container(),
//  COLLISION2: new PIXI.Container(),
  "HUD": new PIXI.Container(),
  "HUD2": new PIXI.Container()
};


window.Container.STAGE.interactive = false;
//Container.STAGE.hitArea = new PIXI.Rectangle(0, 0, Container, 100);

Object.freeze(window.Container);

// FIX (conversion): 'lang' is another canonical cross-file global declaration site (was a bare
// 'lang = new LangData("EN")').
window.lang = new LangData("EN");

const initApp = function(server) {

	const startEvents = function () {
    if (typeof(StatusBar) !== 'undefined')
    	    StatusBar.hide();

}
document.addEventListener("deviceready", startEvents, false);

window.onbeforeunload = function (e) {
  if (typeof userclient !== "undefined" && userclient.connection)
    userclient.connection.close();
  else if (typeof game !== "undefined" && game.client && game.client.connection)
    game.client.connection.close();
};

 	 $(document).ready(function() {

        app = new App();
        app.center();

        DragItem = null;
        DragBank = null;

        if(Detect.isWindows()) {
            // Workaround for graphical glitches on text
            $('body').addClass('windows');
        }

        if(Detect.isOpera()) {
            // Fix for no pointer events
            $('body').addClass('opera');
        }

        if(Detect.isFirefoxAndroid()) {
            // Remove chat placeholder
            $('#chatinput').removeAttr('placeholder');
        }

        $('.barbutton').click(function() {
            $(this).toggleClass('active');
        });
        $('#aboutbutton').click(function() {
            const about = $('#about_window');
            about.toggle();
        });
        $('#aboutclose').click(function() {
            const about = $('#about_window');
            about.hide();
        });

        $('#chatbutton').click(function() {
          app.showChat(!$('#chatbox').hasClass('active'));
        });

        $('#population').click(function() {
            app.togglePopulationInfo();
        });

        $('.clickable').click(function(event) {
            //event.stopPropagation();
            // FIX: handler's parameter is named `event`; `e` was undeclared and would throw a ReferenceError on click
            fnClickFunc(event);
        });

        $('#change-password').click(function() {
            app.loadWindow('loginWindow', 'passwordWindow');
        });

        $('#attack-shortcut').click(function() {
          game.makePlayerInteractNextTo();
        });

        $('.close').click(function() {
            app.hideWindows();
        });

        log.info("App initialized.");

        initGame();

        return app;
    });
};

var initGame = function() {
    const canvas = document.getElementById("entities"),
        input = document.getElementById("chatinput");

    // FIX (conversion): 'game' is another canonical cross-file global declaration site (was a
    // bare 'game = new Game(app)').
    window.game = new Game(app);
    game.setup(input);

    app.setGame(game);

    // FIX: was a no-op comparison (===) instead of an assignment
    game.useServer = "world";

    game.onGameStart(function() {
    });

    game.onDisconnect(function(message) {
        $('#errorwindow').find('p').html(message+"<em>Disconnected. Please reload the page.</em>");
        $('#errorwindow').show();
        $('#errorwindow').focus();
    });

    game.onClientError(function(message) {
        $('#errorwindow').find('p').html(message);
        $('#errorwindow').show();
        $('#errorwindow').focus();
    });

    game.onPlayerDeath(function() {
        game.player.dead();
        $('#diedwindow').show();
        $('#diedwindow').focus();
    });

    game.onNotification(function(message) {
        app.showMessage(message);
    });

    app.initHealthBar();
    //app.initEnergyBar();
    app.initExpBar();
    app.initPlayerBar();

    $('#nameinput').attr('value', '');
    $('#pwinput').attr('value', '');
    $('#pwinput2').attr('value', '');
    $('#emailinput').attr('value', '');
    $('#chatbox').attr('value', '');

    const fnClickFunc = function (e)
    {
      app.center();
      app.setMouseCoordinates(e.data.global.x, e.data.global.y);
      // FIX: typo'd property name (`auctioSellDialogPopuped`) never matched app.js's `auctionsellDialogPopuped`, so this check was always true and never blocked clicks while the auction-sell dialog was open
      if(game && !app.dropDialogPopuped && !app.auctionsellDialogPopuped)
      {
          if (!game.usejoystick)
            game.click();
      }
      app.hideWindows();
      event.stopPropagation();
    };

    $(document).ready(function () {
		    $('#gui').on('click', function(event) {
				//event.preventDefault();

		    });
	          game.inventoryDialog.loadInventoryEvents();
    });
    $('#respawn').click(function(event) {
        game.audioManager.playSound("revive");
        game.respawnPlayer();
        $('#diedwindow').hide();
    });
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
    //game.skillDialog.button = this.skillButton;
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

    $(document).bind('mousedown', function(event){
        if(event.button === 2){
            return false;
        }
    });
    $(document).bind('mouseup', function(event) {
        if(event.button === 2 && game.ready) {
            //game.rightClick();
            return false;
        }
    });

    const jqGame = $('#game');

    let touchX, touchY;
    jqGame.on("touchstart",function(e){
      const r = game.renderer;
      game.playerClick = false;

      const dpr = window.devicePixelRatio || 1;
      const touch = e.touches[0];
      const rect = this.getBoundingClientRect();

      const scaleX = this.width / rect.width;
      const scaleY = this.height / rect.height;

      const x = (touch.clientX - rect.left) * scaleX;
      const y = (touch.clientY - rect.top) * scaleY;

      app.setMouseCoordinates(x, y);

      if(game.started) {
          game.movecursor();
      }
      game.click();
      e.preventDefault();
    });

    jqGame.on("touchmove",function(e){
    });

    jqGame.on("touchend",function(e){
    });

    jqGame.on("click", function(e) {
					game.click();
        e.preventDefault();
    });

    jqGame.mousemove(function(e) {
        const x = e.offsetX;
        const y = e.offsetY;
        app.setMouseCoordinates(x, y);
        if(game.started) {
            game.updateCursor();
            //game.movecursor();
        }
    });


    const jqChatbox = $('#chatbox');
    const jqDropDialog = $('#dropDialog');
    const jqChatInput = $('#chatinput');
    const jqForeground = $('#foreground');
    const jqUserWindow = $('#user_window');
    const jqPlayerWindow = $('#player_window');
    const jqInput = $('input');
    const jqPlayerCreateForm = $('#player_create_form');
    const jqPlayerLoad = $('#player_load');
    const jqDropAccept = $("#dropAccept");
    const jqDropCancel = $("#dropCancel");
    const jqAuctionSellDialog = $("#auctionSellDialog");
    const jqDialogModalNotify = $("#dialogModalNotify");
    const jqDialogModalConfirm = $("#dialogModalConfirm");

    const jqShortcut = [];
    for(let i=0; i < 8; ++i)
      jqShortcut[i] = $('#shortcut'+i);

    const fnCondition = function () {
      return game.player && game.started && game.mapStatus >= 2 && !jqChatbox.hasClass('active') && !jqDropDialog.is(":visible")
       && !jqAuctionSellDialog.is(":visible") && !jqDialogModalNotify.is(":visible") && !jqDialogModalConfirm.is(":visible");
    };

    const fnGameKeys = fnCondition;

    const keyboard = function (value) {
        const key = {
          "value": value,
          "isDown": false,
          "isUp": true,
          "press": undefined,
          "release": undefined
        };

        //The `downHandler`
        key.downHandler = function (event) {
          if (!fnCondition())
            return;

          for (var k of key.value) {
            if (event.which === k) {
              if (key.isUp && key.press) {
                key.press();
              }
              key.isDown = true;
              key.isUp = false;
              event.preventDefault();
              event.stopPropagation();
            }
          }
        };

        //The `upHandler`
        key.upHandler = function (event) {
          if (!fnCondition())
            return;

          for (var k of key.value) {
            if (event.which === k) {
              if (key.isDown && key.release) {
                key.release();
              }
              key.isDown = false;
              key.isUp = true;
              event.preventDefault();
              event.stopPropagation();
            }
          }
        };

        //Attach event listeners
        const downListener = key.downHandler.bind(key);
        const upListener = key.upHandler.bind(key);

        window.addEventListener("keydown", downListener, false);
        window.addEventListener("keyup", upListener, false);

        // Detach event listeners
        key.unsubscribe = () => {
          window.removeEventListener("keydown", downListener);
          window.removeEventListener("keyup", upListener);
        };

        return key;
      }

      const fnKeyLeft = keyboard([Types.Keys.LEFT,Types.Keys.A,Types.Keys.KEYPAD_4]);
      fnKeyLeft.press = function () {
        game.player.move(Types.Orientations.LEFT, true);
      };
      fnKeyLeft.release = function () {
        game.player.move(Types.Orientations.LEFT, false);
      };

      const fnKeyRight = keyboard([Types.Keys.RIGHT,Types.Keys.D,Types.Keys.KEYPAD_6]);
      fnKeyRight.press = function () {
        game.player.move(Types.Orientations.RIGHT, true);
      };
      fnKeyRight.release = function () {
        game.player.move(Types.Orientations.RIGHT, false);
      };

      const fnKeyUp = keyboard([Types.Keys.UP,Types.Keys.W,Types.Keys.KEYPAD_8]);
      fnKeyUp.press = function () {
        game.player.move(Types.Orientations.UP, true);
      };
      fnKeyUp.release = function () {
        game.player.move(Types.Orientations.UP, false);
      };

      const fnKeyDown = keyboard([Types.Keys.DOWN,Types.Keys.S,Types.Keys.KEYPAD_2]);
      fnKeyDown.press = function () {
        game.player.move(Types.Orientations.DOWN, true);
      };
      fnKeyDown.release = function () {
        game.player.move(Types.Orientations.DOWN, false);
      };

      app.releaseKeys = function () {
        const key = [fnKeyRight, fnKeyLeft, fnKeyUp, fnKeyDown];
        for (let k of key) {
          k.isDown = false;
          k.isUp = true;
        }
      }

    const fnKeyAction = function (e) {
      const key = e.which;

      if(key === Types.Keys.ENTER) { // Enter
          if (jqDialogModalNotify.is(":visible")) {
            $('#dialogModalNotifyButton1').trigger("click");
            return false;
          }
          else if (jqDialogModalConfirm.is(":visible")) {
            $('#dialogModalConfirmButton1').trigger("click");
            return false;
          }
          else if(game.started) {
              app.showChat(!jqChatbox.hasClass('active'));
              return false; // prevent form submit.
          }

      }

      if(key === Types.Keys.ESCAPE) {
          // FIX: copy-paste bug - both branches checked jqDialogModalConfirm, so Escape did nothing while the
          // notify dialog was visible and wrongly clicked the notify button while the confirm dialog was visible.
          // First branch now checks jqDialogModalNotify, matching the parallel ENTER-key handler above.
          if (jqDialogModalNotify.is(":visible")) {
            $('#dialogModalNotifyButton1').trigger("click");
            return false;
          }
          else if (jqDialogModalConfirm.is(":visible")) {
            $('#dialogModalConfirmButton2').trigger("click");
            return false;
          }
      }

      if (fnGameKeys()) {
          switch(key) {
              case Types.Keys.T:
                  game.playerTargetClosestEntity(1);
                  return false;
              case Types.Keys.Y:
                  game.playerTargetClosestEntity(-1);
                  return false;
              case Types.Keys.SPACE:
                  game.makePlayerInteractNextTo();
                  return false;
              case Types.Keys.KEY_1:
                jqShortcut[0].trigger('click');
                return false;
              case Types.Keys.KEY_2:
                jqShortcut[1].trigger('click');
                return false;
              case Types.Keys.KEY_3:
                jqShortcut[2].trigger('click');
                return false;
              case Types.Keys.KEY_4:
                jqShortcut[3].trigger('click');
                return false;
              case Types.Keys.KEY_5:
                jqShortcut[4].trigger('click');
                return false;
              case Types.Keys.KEY_6:
                jqShortcut[5].trigger('click');
                return false;
              case Types.Keys.KEY_7:
                jqShortcut[6].trigger('click');
                return false;
              case Types.Keys.KEY_8:
                jqShortcut[7].trigger('click');
                return false;
              default:
                  break;
          }
      }
    };

    $(document).keydown(function (e) {
      if (e.repeat) {
        return true;
      }
      return fnKeyAction(e);
    });

    jqPlayerWindow.keydown(function (e) {
      if (e.which === 13) {
        jqInput.blur();
        if (jqPlayerCreateForm.is(':visible'))
          app.tryPlayerAction(4);
        else if(jqPlayerLoad.is(':visible'))
          app.tryPlayerAction(3);
        return false;
      }
    });

    jqUserWindow.keydown(function (e) {
      if (e.which === 13 && app.userReady) {
        jqInput.blur();      // exit keyboard on mobile
        app.tryUserAction(1);
        return false;
      }
    });

    $('#errorwindow').keydown(function (e) {
      if (e.which === 13) {
        location.reload();
        return false;
      }
    });

    $('#auctionSellDialog').keydown(function (e) {
      const key = e.which;
      if (key === Types.Keys.ENTER) {
        $('#auctionSellAccept').trigger("click");
        return false;
      }
      else if (key === Types.Keys.ESCAPE) {
        $('#auctionSellCancel').trigger("click");
        return false;
      }
    });

    $('#dropCount').keydown(function (e) {
      const key = e.which;
      if (key === Types.Keys.ENTER) {
        jqDropAccept.trigger("click");
        return false;
      }
      else if (key === Types.Keys.ESCAPE) {
        jqDropCancel.trigger("click");
        return false;
      }
    });

    $('#diedwindow').keydown(function (e) {
      if(e.which === Types.Keys.ENTER) {
        $('#respawn').trigger("click");
        return false;
      }
    });

    jqChatInput.keydown(function(e) {
        if (e.repeat) { return; }
        const key = e.which,
            placeholder = $(this).attr("placeholder");

        if(key === 13) {
            if(jqChatInput.val() !== '') {
                if(game.player) {
                    game.say(jqChatInput.val());
                }
                jqChatInput.val('');
                app.showChat(false);
                //jqForeground.focus();
                return false;
            } else {
                app.showChat(false);
                return false;
            }
        }

        if(key === 27) {
            app.showChat(false);
            return false;
        }
    });

    $('#chatinput').focus(function(e) {
        const placeholder = $(this).attr("placeholder");

        if(!Detect.isFirefoxAndroid()) {
            $(this).val(placeholder);
        }

        if ($(this).val() === placeholder) {
            this.setSelectionRange(0, 0);
        }
    });


    jqDropAccept.click(function(event) {
        //var pos = game.getMouseGridPosition();
        let count = parseInt($('#dropCount').val());
        if(count > 0) {
        	if (app.dropAction === "bankgold") // Send to bank.
        	{
            const gold = game.player.gold[0];
        		if (count > gold) count=gold;
        		game.client.sendGold(0, count, 1);
        	}
        	else if (app.dropAction === "inventorygold") // Send to inventory.
        	{
            const bgold = game.player.gold[1];
        		if (count > bgold) count=bgold;
        		game.client.sendGold(1, count, 0);
        	}
          else if (app.dropAction === "splititems") // Split Items.
          {
            game.inventory.sendSplitItem(game.app.SplitItem, count);
            game.app.SplitItem = null;
          }
        	else if (app.dropAction === "dropItems") // Drop Items
        	{
            game.inventory.sendDropItem(game.app.DropItem, count);
            game.app.DropItem = null;
        	}
        }

        setTimeout(function () {
            app.hideDropDialog();
        }, 100);

    });

    jqDropCancel.click(function(event) {
        setTimeout(function () {
            app.hideDropDialog();
        }, 100);

    });

    $('#auctionSellAccept').click(function(event) {
        try {
            const count = parseInt($('#auctionSellCount').val());
            if(count > 0) {
                game.client.sendAuctionSell(app.inventoryNumber,count);
                game.inventoryDialog.inventory[app.inventoryNumber] = null;
            }
        } catch(e) {
        }

        setTimeout(function () {
            app.hideAuctionSellDialog();
        }, 100);
    });

    $('#auctionSellCancel').click(function(event) {
        setTimeout(function () {
            app.hideAuctionSellDialog();
        }, 100);
    });

    $('#nameinput').focusin(function() {
        $('#name-tooltip').addClass('visible');
    });

    $('#nameinput').focusout(function() {
        $('#name-tooltip').removeClass('visible');
    });

    $('#nameinput').keypress(function(event) {
        $('#name-tooltip').removeClass('visible');
    });

    if(game.tablet) {
        $('body').addClass('tablet');
    }

	document.addEventListener('DOMContentLoaded', function () {
	  // check whether the runtime supports screen.lockOrientation
	  if (screen.lockOrientation) {
	    // lock the orientation
	    screen.lockOrientation('landscape');
	  }

	  // ...rest of the application code...
	});

	// FIX (conversion): was a bare 'console = {}' fallback assignment; console is a host global
	// that always exists in browser/NW.js contexts, so this branch is unreachable in practice,
	// but the assignment is made explicit for ES module strict mode in case it ever is.
	if(typeof console === "undefined"){
	      window.console = {};
	}
};

initApp();

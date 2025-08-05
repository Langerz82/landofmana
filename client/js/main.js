
/* global Types */
app = null;
G_LATENCY = 75;
G_ROUNDTRIP = G_LATENCY * 2;
G_UPDATE_INTERVAL = 16;
//G_RENDER_INTERVAL = 16;
G_TILESIZE = 16;

ATTACK_INTERVAL = 1000;
ATTACK_MAX = 3000;

Container = {
  STAGE: new PIXI.Container(),
  BACKGROUND: new PIXI.Container(),
  ENTITIES: new PIXI.Container(),
  FOREGROUND: new PIXI.Container(),
  COLLISION: new PIXI.Container(),
  COLLISION2: new PIXI.Container(),
  HUD: new PIXI.Container(),
  HUD2: new PIXI.Container()
};

Container.STAGE.interactive = true;
//Container.STAGE.hitArea = new PIXI.Rectangle(0, 0, Container, 100);

Object.freeze(Container);

define(['app', 'data/langdata', 'util',
    'button2', 'dialog/dialog', 'game'], function(App, LangData) {
    //global app, game;
    lang = new LangData("EN");

    var initApp = function(server) {

    	var startEvents = function () {
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
            /*
            $('#rankingbutton').click(function(event){
                if(app.game && app.ready && app.game.ready){
                    app.game.client.sendRanking('get');
                    app.hideAllSubwindow();
                    app.game.rankingHandler.show();
                }
            });*/
            $('#aboutbutton').click(function() {
                var about = $('#about_window');
                about.toggle();
            });
            $('#aboutclose').click(function() {
                var about = $('#about_window');
                about.hide();
            });

            $('#chatbutton').click(function() {
              app.showChat(!$('#chatbox').hasClass('active'));
            });

            /*$('#instructions').click(function() {
                app.hideWindows();
            });

            $('#playercount').click(function() {
             app.togglePopulationInfo();
             }); */

            $('#population').click(function() {
                app.togglePopulationInfo();
            });

            $('.clickable').click(function(event) {
                //event.stopPropagation();
                fnClickFunc(e);
            });

            $('#change-password').click(function() {
                app.loadWindow('loginWindow', 'passwordWindow');
            });

      			$('#shortcutbutton').click(function() {
      				$('#attackContainer').show();
      				$('#shortcutbutton').hide();
      			});

            $('#attackContainerClose').click(function() {
				      $('#shortcutbutton').show();
				      $('#attackContainer').hide();
            });

            $('#attackbackground').click(function() {
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
        require(['game', 'button2'], function(Game, Button2) {
            var canvas = document.getElementById("entities"),
                input = document.getElementById("chatinput");

            game = new Game(app);
            game.setup(input);

            app.setGame(game);

            game.useServer === "world";

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
            app.initEnergyBar();
            app.initExpBar();
            app.initPlayerBar();

            $('#nameinput').attr('value', '');
            $('#pwinput').attr('value', '');
            $('#pwinput2').attr('value', '');
            $('#emailinput').attr('value', '');
            $('#chatbox').attr('value', '');

            var fnClickFunc = function (e)
            {
              app.center();
              app.setMouseCoordinates(e.data.global.x, e.data.global.y);
              if(game && !app.dropDialogPopuped && !app.auctioSellDialogPopuped)
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
		          game.inventoryHandler.loadInventoryEvents();
            });
            $('#respawn').click(function(event) {
                game.audioManager.playSound("revive");
                game.respawnPlayer();
                $('#diedwindow').hide();
            });
            this.scale = game.renderer.getScaleFactor();

            Button2.configure = {background: {top: this.scale * 0, width: this.scale * 0}, kinds: [0, 3, 2]};

            var self = this;

            // Inventory Button
            this.inventoryButton = new Button2('#inventory', {background: {left: 0, top: 32}});
            this.inventoryButton.onClick(function(sender, event) {
              if(game && game.ready) {
                game.inventoryHandler.toggleInventory();
              }
            });

            // Character Button
            this.statButton = new Button2('#character', {background: {left: 4*32 }});
            this.statButton.onClick(function(sender, event) {
                app.toggleCharacter();
            });
            game.statDialog.button = this.statButton;
            app.toggleCharacter = function() {
      				if(game && game.ready) {
      					game.statDialog.show();
      				}
            };

            // Skill button
            this.skillButton = new Button2('#skill', {background: {left: 96 }});
            this.skillButton.onClick(function(sender, event) {
                app.toggleSkill();
            });
            //game.skillDialog.button = this.skillButton;
            app.toggleSkill = function() {
      				if(game && game.ready) {
      					game.skillDialog.show();
      				}
            };

            // Quest Button
            this.questButton = new Button2('#help', {background: {left: 352}});
            this.questButton.onClick(function(sender, event) {
                game.questhandler.toggleShowLog();
            });

            // Settings Button
            this.settingsButton = new Button2('#settings', {background: {left: 32}, downed: false});
            this.settingsButton.onClick(function(sender, event) {
                game.settingsHandler.show();
            });
            game.settingsButton = this.settingsButton;

            // Warp Button
            this.warpButton = new Button2('#warp', {background: {left: 482}});
            this.warpButton.onClick(function(sender, event) {
                app.toggleWarp();
            });
            game.warpButton = this.warpButton;
            app.toggleWarp = function() {
                if(game && game.ready) {
                    game.teleportMaps(0);
                }
            };

	          // Party Button
            this.socialButton = new Button2('#social', {background: {left: 416}});
            this.socialButton.onClick(function(sender, event) {
                app.toggleSocial()
            });
            game.socialButton = this.socialButton;
            app.toggleSocial = function() {
                if(game && game.ready) {
                	game.socialHandler.show();
                }
            }

			      // Leader Button
            this.achievementButton = new Button2('#achievement', {background: {left: 448}});
            this.achievementButton.onClick(function(sender, event) {
                game.achievementHandler.toggleShowLog();
            });
            game.achievementButton = this.achievementButton;

            // Store Button
            this.storeButton = new Button2('#store', {background: {left: 160}});
            this.storeButton.onClick(function(sender, event) {
                app.toggleStore();
            });
            game.storeButton = this.storeButton;
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

            var jqGame = $('#game');

            var touchX, touchY;
            jqGame.on("touchstart",function(e){
              game.playerClick = false;
              var left = this.offsetParent.offsetLeft;
              var top = this.offsetParent.offsetTop;
              touchX = ~~((e.touches[0].pageX-left) * game.renderer.gameZoom);
              touchY = ~~((e.touches[0].pageY-top) * game.renderer.gameZoom);
              app.setMouseCoordinates(touchX, touchY);
              if(game.started) {
                  game.movecursor();
              }
            });

            jqGame.on("touchmove",function(e){
            });

            jqGame.on("touchend",function(e){
            });

            jqGame.on('click touchend', function(event) {
								game.click();
            });

            jqGame.mousemove(function(e) {
                var x = e.offsetX;
                var y = e.offsetY;
                app.setMouseCoordinates(x, y);
                if(game.started) {
                    game.updateCursor();
                    //game.movecursor();
                }
            });


            var jqChatbox = $('#chatbox');
            var jqDropDialog = $('#dropDialog');
            var jqChatInput = $('#chatinput');
            var jqForeground = $('#foreground');
            var jqUserWindow = $('#user_window');
            var jqPlayerWindow = $('#player_window');
            var jqInput = $('input');
            var jqPlayerCreateForm = $('#player_create_form');
            var jqPlayerLoad = $('#player_load');
            var jqDropAccept = $("#dropAccept");
            var jqDropCancel = $("#dropCancel");
            var jqAuctionSellDialog = $("#auctionSellDialog");
            var jqDialogModalNotify = $("#dialogModalNotify");
            var jqDialogModalConfirm = $("#dialogModalConfirm");

            var jqShortcut = [];
            for(var i=0; i < 8; ++i)
              jqShortcut[i] = $('#shortcut'+i);

            var fnCondition = function () {
              return game.player && game.started && !jqChatbox.hasClass('active') && !jqDropDialog.is(":visible")
               && !jqAuctionSellDialog.is(":visible") && !jqDialogModalNotify.is(":visible") && !jqDialogModalConfirm.is(":visible");
            };

            var fnGameKeys = fnCondition;

            var keyboard = function (value) {
                var key = {
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
                    }
                  }
                };

                //Attach event listeners
                var downListener = key.downHandler.bind(key);
                var upListener = key.upHandler.bind(key);

                window.addEventListener("keydown", downListener, false);
                window.addEventListener("keyup", upListener, false);

                // Detach event listeners
                key.unsubscribe = () => {
                  window.removeEventListener("keydown", downListener);
                  window.removeEventListener("keyup", upListener);
                };

                return key;
              }

              var fnKeyLeft = keyboard([Types.Keys.LEFT,Types.Keys.A,Types.Keys.KEYPAD_4]);
              fnKeyLeft.press = function () {
                game.player.move(Types.Orientations.LEFT, true);
              };
              fnKeyLeft.release = function () {
                game.player.move(Types.Orientations.LEFT, false);
              };

              var fnKeyRight = keyboard([Types.Keys.RIGHT,Types.Keys.D,Types.Keys.KEYPAD_6]);
              fnKeyRight.press = function () {
                game.player.move(Types.Orientations.RIGHT, true);
              };
              fnKeyRight.release = function () {
                game.player.move(Types.Orientations.RIGHT, false);
              };

              var fnKeyUp = keyboard([Types.Keys.UP,Types.Keys.W,Types.Keys.KEYPAD_8]);
              fnKeyUp.press = function () {
                game.player.move(Types.Orientations.UP, true);
              };
              fnKeyUp.release = function () {
                game.player.move(Types.Orientations.UP, false);
              };

              var fnKeyDown = keyboard([Types.Keys.DOWN,Types.Keys.S,Types.Keys.KEYPAD_2]);
              fnKeyDown.press = function () {
                game.player.move(Types.Orientations.DOWN, true);
              };
              fnKeyDown.release = function () {
                game.player.move(Types.Orientations.DOWN, false);
              };

            var fnKeyDown = function (e) {
              var key = e.which;

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
                  if (jqDialogModalConfirm.is(":visible")) {
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

/*
            $(document).keyup(function(e) {
                if (e.repeat)
                  return false;

                return fnMoveKeys(e, false);
            });
*/

            $(document).keydown(function (e) {
              if (e.repeat) {
                return true;
              }
              return fnKeyDown(e);
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
              var key = e.which;
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
              var key = e.which;
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
                var key = e.which,
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
                var placeholder = $(this).attr("placeholder");

                if(!Detect.isFirefoxAndroid()) {
                    $(this).val(placeholder);
                }

                if ($(this).val() === placeholder) {
                    this.setSelectionRange(0, 0);
                }
            });


            jqDropAccept.click(function(event) {
                //var pos = game.getMouseGridPosition();
                var count = parseInt($('#dropCount').val());
                if(count > 0) {
                	if (app.dropAction === "bankgold") // Send to bank.
                	{
                    var gold = game.player.gold[0];
                		if (count > gold) count=gold;
                		game.client.sendGold(0, count, 1);
                	}
                	else if (app.dropAction === "inventorygold") // Send to inventory.
                	{
                    var bgold = game.player.gold[1];
                		if (count > bgold) count=bgold;
                		game.client.sendGold(1, count, 0);
                	}
                  else if (app.dropAction === "splititems") // Split Items.
                  {
                    game.inventoryHandler.sendSplitItem(game.app.SplitItem, count);
                    game.app.SplitItem = null;
                  }
                	else if (app.dropAction === "dropItems") // Drop Items
                	{
                    game.inventoryHandler.sendDropItem(game.app.DropItem, count);
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
                    var count = parseInt($('#auctionSellCount').val());
                    if(count > 0) {
                        game.client.sendAuctionSell(app.inventoryNumber,count);
                        game.inventoryHandler.inventory[app.inventoryNumber] = null;
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
        });

/*
        $('#healthbar').bind('mousedown', function (event) {
            if(event.button === 2) {
                return false;
            }
        });

        $('#healthbar').bind('mouseup', function (event) {
            if(event.button === 2) {
                if(game.autoEattingHandler) {
                    clearInterval(game.autoEattingHandler);

                    $('#hpguide').css('display', 'none');
                }
                return false;
            }
        });

        $('#hpguide').bind('mousedown', function (event) {
            if(event.button === 2) {
                return false;
            }
        });

        $('#hpguide').bind('mouseup', function (event) {
            if(event.button === 2) {
                if(game.autoEattingHandler) {
                    clearInterval(game.autoEattingHandler);

                    $('#hpguide').css('display', 'none');
                }
                return false;
            }
        });
*/

    	/*$(window).blur(function(){
    	  if (game && game.client && game.player && game.started);
    	  	  //game.client.sendHasFocus(0);
    	});
    	$(window).focus(function(){
    	  if (game && game.client && game.player && game.started);
    	  	  //game.client.sendHasFocus(1);
    	});*/

	document.addEventListener('DOMContentLoaded', function () {
	  // check whether the runtime supports screen.lockOrientation
	  if (screen.lockOrientation) {
	    // lock the orientation
	    screen.lockOrientation('landscape');
	  }

	  // ...rest of the application code...
	});


	if(typeof console === "undefined"){
	      console = {};
	}
    };

    return initApp();
});

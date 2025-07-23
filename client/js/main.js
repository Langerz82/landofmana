
/* global Types */
app = null;
G_LATENCY = 75;
G_ROUNDTRIP = G_LATENCY * 2;
G_UPDATE_INTERVAL = 16;
//G_RENDER_INTERVAL = 16;
G_TILESIZE = 16;

ATTACK_INTERVAL = 1000;
ATTACK_MAX = 4000;

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
    'button2', 'dialog/dialog', 'game', 'bubble'], function(App, LangData) {
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
  }

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
                if($('#chatbox').hasClass('active')) {
                    app.hideChat();
                } else {
                    app.showChat();
                }
                /*if($('#chatbutton').hasClass('active')) {
                    app.showChat();
                } else {
                    app.hideChat();
                }*/
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
                clickFunc(e);
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

            // Create New Character fields
            /*$('#nameinput').bind("keyup", function() {
                app.toggleButton();
            });
            $('#pwinput').bind("keyup", function() {
                app.toggleButton();
            });
            $('#pwinput2').bind("keyup", function() {
                app.toggleButton();
            });
            $('#emailinput').bind("keyup", function() {
                app.toggleButton();
            });

            // Change Password Fields.
            $('#cpnameinput').bind("keyup", function() {
                app.toggleButton();
            });
            $('#cppwinputold').bind("keyup", function() {
                app.toggleButton();
            });
            $('#cppwinput').bind("keyup", function() {
                app.toggleButton();
            });
            $('#cppwinput2').bind("keyup", function() {
                app.toggleButton();
            });*/


            //$('#notifications div').bind(TRANSITIONEND, app.resetMessagesPosition.bind(app));

            $('.close').click(function() {
                app.hideWindows();
            });

            //$('.play').click(function(event) {
                 //app.tryStartingGame();

                 /*switch (app.initialAction)
                 {
                 case "loadcharacter":
                   log.info("sendLogin");
                   client.sendLogin(self.player);
                   break;
                 case "createcharacter":
                   client.sendCreate(self.player);
                   break;
                 } */
            //});

            //document.addEventListener("touchstart", function() {},false);


            //$('#resize-check').bind("transitionend", app.resizeUi.bind(app));
            //$('#resize-check').bind("webkitTransitionEnd", app.resizeUi.bind(app));
            //$('#resize-check').bind("oTransitionEnd", app.resizeUi.bind(app));

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

            game.useServer == "world";

            game.onGameStart(function() {
            });

            game.onDisconnect(function(message) {
                $('#errorwindow').find('p').html(message+"<em>Disconnected. Please reload the page.</em>");
                $('#errorwindow').show();
            });

            game.onClientError(function(message) {
                $('#errorwindow').find('p').html(message);
                $('#errorwindow').show();
            });

            game.onPlayerDeath(function() {
                game.player.dead();
                //game.removeEntity(game.player);

                //game.player.flipSpriteY = false;
                //$('body').addClass('death');
                $('#diedwindow').show();
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

            var clickFunc = function (e)
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

            /*if(game.renderer.mobile || game.renderer.tablet) {
              Container.STAGE.addListener('touchstart', (e) => {
                clickFunc(e);
              });
              Container.STAGE.addListener('touchend', (e) => {
              });
            } else {
              Container.STAGE.addListener('pointerdown', (e) => {
                //console.log("clicked");
                //clickFunc(e);
              });
              Container.STAGE.addListener('pointermove', (e) => {
                  //console.log("fired");
                  app.setMouseCoordinates(e.data.global.x, e.data.global.y);
                  if(game.started) {
                      game.movecursor();
                  }
              });
            }*/

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

            // Chat Button
            /*this.chatButton = new Button2('#chat', {background: {left: this.scale * 0}});
            this.chatButton.onClick(function(sender, event) {
                app.toggleChat();
                event.preventDefault();
            });
            game.chatButton = this.chatButton;
            app.toggleChat = function() {
                if(game && game.ready) {
            			if(!$('#chatbutton').hasClass('active')) {
            				app.showChat();
            			} else {
            				app.hideChat();
            			}
                }
            }*/

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


            //var keyMoves = {};
            //var pMove = 0;
            //var keyPressed = 0;
            var jqChatbox = $('#chatbox');
            var jqDropDialog = $('#dropDialog');
            var jqChatInput = $('#chatinput');
            var jqForeground = $('#foreground');
            var jqShortcut = [];
            for(var i=0; i < 8; ++i)
              jqShortcut[i] = $('#shortcut'+i);

            var moveKeys = function (e, bool) {
              var key = e.which;
              var p = game.player;
              var gameKeys = p && game.started && !jqChatbox.hasClass('active');
              if (gameKeys) {
                  if (bool && self.keyPressed == key) {
                    //console.warn("same key pressed.")
                    return;
                  }
                  switch(key) {
                      case Types.Keys.LEFT:
                      case Types.Keys.A:
                      case Types.Keys.KEYPAD_4:
                          p.move(Types.Orientations.LEFT, bool);
                          self.keyPressed = (bool) ? key : 0;
                          break;
                      case Types.Keys.RIGHT:
                      case Types.Keys.D:
                      case Types.Keys.KEYPAD_6:
                          p.move(Types.Orientations.RIGHT, bool);
                          self.keyPressed = (bool) ? key : 0;
                          break;
                      case Types.Keys.UP:
                      case Types.Keys.W:
                      case Types.Keys.KEYPAD_8:
                          p.move(Types.Orientations.UP, bool);
                          self.keyPressed = (bool) ? key : 0;
                          break;
                      case Types.Keys.DOWN:
                      case Types.Keys.S:
                      case Types.Keys.KEYPAD_2:
                          p.move(Types.Orientations.DOWN, bool);
                          self.keyPressed = (bool) ? key : 0;
                          break;
                  }
              }
            };

            $(document).keyup(function(e) {
                moveKeys(e, false);
            });

            var keyDown = function (e) {
              var key = e.which;

              if(jqDropDialog.is(":visible")) {
                if (key === Types.Keys.ENTER)
                  $("#dropAccept").trigger("click");
                else if (key === Types.Keys.ESCAPE)
                  $("#dropCancel").trigger("click");
                return;
              }

              if(key === Types.Keys.ENTER) {
                  if(jqChatbox.hasClass('active')) {
                      app.hideChat();
                  } else {
                      app.showChat();
                  }
              }

              moveKeys(e, true);

              var p = game.player;
              var gameKeys = p && game.started && !jqChatbox.hasClass('active');
              if (gameKeys) {
                  switch(key) {
                      case Types.Keys.T:
                          game.playerTargetClosestEntity(1);
                          break;
                      case Types.Keys.Y:
                          game.playerTargetClosestEntity(-1);
                          break;
                      case Types.Keys.SPACE:
                          game.makePlayerInteractNextTo();
                          break;
                      case Types.Keys.KEY_1:
                        jqShortcut[0].trigger('click');
                        break;
                      case Types.Keys.KEY_2:
                        jqShortcut[1].trigger('click');
                        break;
                      case Types.Keys.KEY_3:
                        jqShortcut[2].trigger('click');
                        break;
                      case Types.Keys.KEY_4:
                        jqShortcut[3].trigger('click');
                        break;
                      case Types.Keys.KEY_5:
                        jqShortcut[4].trigger('click');
                        break;
                      case Types.Keys.KEY_6:
                        jqShortcut[5].trigger('click');
                        break;
                      case Types.Keys.KEY_7:
                        jqShortcut[6].trigger('click');
                        break;
                      case Types.Keys.KEY_8:
                        jqShortcut[7].trigger('click');
                        break;
                      default:
                          break;
                  }
              }
            };

            $(document).keydown(keyDown);

            /*
            $('#attackButton').on("touchstart mousedown", function(e) {
                if (!game.player || game.player.isDead)
                	return;

                e.preventDefault();
                setTimeout(function() {
                		game.makePlayerInteractNext();
                }, game.inputLatency);
            });
            $('#attackButton').on("mouseup touchend", function(e) {
            	clearInterval(game.autoattack);
            });
            */



            //var keyFired= false;
            jqChatInput.keydown(function(e) {
                if (e.repeat) { return; }
                /*if(keyFired) {
                  return;
                }
                keyFired = true;*/
                var key = e.which,
                    placeholder = $(this).attr("placeholder");

                //   if (!(e.shiftKey && e.keyCode === 16) && e.keyCode !== 9) {
                //        if ($(this).val() === placeholder) {
                //           $(this).val('');
                //            $(this).removeAttr('placeholder');
                //            $(this).removeClass('placeholder');
                //        }
                //    }

                if(key === 13) {
                    if(jqChatInput.val() !== '') {
                        if(game.player) {
                            game.say(jqChatInput.val());
                        }
                        jqChatInput.val('');
                        app.hideChat();
                        jqForeground.focus();
                        return false;
                    } else {
                        app.hideChat();
                        return false;
                    }
                }

                if(key === 27) {
                    app.hideChat();
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


            $('#dropAccept').click(function(event) {
                //var pos = game.getMouseGridPosition();
                var count = parseInt($('#dropCount').val());
                if(count > 0) {
                	if (app.dropAction == "bankgold") // Send to bank.
                	{
                    var gold = game.player.gold[0];
                		if (count > gold) count=gold;
                		game.client.sendGold(0, count, 1);
                	}
                	else if (app.dropAction == "inventorygold") // Send to inventory.
                	{
                    var bgold = game.player.gold[1];
                		if (count > bgold) count=bgold;
                		game.client.sendGold(1, count, 0);
                	}
                  else if (app.dropAction == "splititems") // Split Items.
                  {
                    game.inventoryHandler.sendSplitItem(game.app.SplitItem, count);
                    game.app.SplitItem = null;
                  }
                	else if (app.dropAction == "dropItems") // Drop Items
                	{
                    game.inventoryHandler.sendDropItem(game.app.DropItem, count);
                    game.app.DropItem = null;
                	}
                }

                setTimeout(function () {
                    app.hideDropDialog();
                }, 100);

            });

            $('#dropCancel').click(function(event) {
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

            /*$('#mutebutton').click(function() {
                game.audioManager.toggle();
            });

            $('#helpbutton').click(function() {
                game.questhandler.toggleShowLog();
            });*/

            var mainKeyDown = function(e) {
                var key = e.which,
                    $chat = $('#chatinput');

                if(key === 13) { // Enter
                    if(game.started) {
                        $chat.focus();
                        return false;
                    }
                    if ($('#user_window').is(':visible'))
                    {
                        $('input').blur();      // exit keyboard on mobile
                        app.tryUserAction(1);
                        return false;           // prevent form submit
                    }
                    if ($('#player_window').is(':visible'))
                    {
                        $('input').blur();      // exit keyboard on mobile
                        if ($('#player_create_form').is(':visible'))
                          app.tryPlayerAction(4);
                        else if($('#player_load').is(':visible'))
                          app.tryPlayerAction(3);
                        return false;           // prevent form submit
                    }

                }
            };

            $(document).bind("keydown", mainKeyDown);

            if(game.renderer.tablet) {
                $('body').addClass('tablet');
            }
        });
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

    $('#armorColor').change(function(e) {
      log.info($(this).val());
    	var color = $(this).val();
    	game.client.sendColorTint("armorColor", color);
  		game.player.armorColor = color;

  		game.renderer.removeBodyColorCanvas(game.player);
  		game.renderer.createBodyColorCanvas(game.player);

    });

    $('#weaponColor').change(function(e) {
      log.info($(this).val());
    	var color = $(this).val();
    	game.client.sendColorTint("weaponColor", color);
  		game.player.weaponColor = color;

  		game.renderer.removeWeaponColorCanvas(game.player);
  		game.renderer.createWeaponColorCanvas(game.player);

    });

    return initApp();
});

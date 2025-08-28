
/* global Mob, Types, Item, log, _, TRANSITIONEND, Class */

define(['lib/localforage', 'entity/mob', 'entity/item', 'data/mobdata', 'user', 'userclient', 'config', 'playeranim'],
  function(localforage, Mob, Item, MobData, User, UserClient, config, PlayerAnim) {

    var App = Class.extend({
        init: function() {
            app = this;

            this.currentPage = 1;
            this.blinkInterval = null;
            this.ready = false;

            this.initFormFields();
            this.dropDialogPopuped = false;
            this.auctionsellDialogPopuped = false;

            this.inventoryNumber = 0;

            this.userReady = false;

            this.classNames = ["user_window",
            	"player_window"];
            this.loadWindow(this.classNames[1],this.classNames[0]);

      		   localforage.getItem('user_hash', function(e, val) {
      		   	   log.info("val="+val);
      			     $('#user_hash').value = val;
      		   });
      		   localforage.getItem('user_name', function(e, val) {
      		   	   log.info("val="+val);
      			     $('#user_name').value = val;
      		   });
      		   $('#user_password').value = "";

		        var self = this;

            this.$loginInfo = $('#loginInfo');

            $('#error_refresh').click(function(event){
            		location.reload();
            });

            $('#cmdQuit').click(function(event){
            		navigator.app.exitApp();
            });

            $('#user_remove').click(function (event) {
              $('#remove_window').show();
            });
            $('#user_close').click(function (event) {
              $('#remove_window').hide();
            });

            $('#user_remove_confirm').click(function (event) {
              var rpawd = $('#remove_confirm').val();
              if (rpawd === "YES")
              {
                if(confirm("DANGER - Remove your account PERMANENTLY?")) {
                  if (confirm("DANGER - Are you really sure to remove your account FOREVER?")) {
                    app.tryUserAction(3);
                    //location.reload();
                  }
                }
                $('#remove_window').hide();
              }
            });

            $('#player_window').ready(function () {
              $('#player_create_form').hide();
              $('#player_load').hide();
              $('#player_create').show();
            });

            $('#player_select').change(function () {
              if ($(this).val() === -1)
              {
                $('#player_load').hide();
                $('#player_create').show();
                $('#player_create_form').show();
              }
              else
              {
                $('#player_load').show();
                $('#player_create_form').hide();
              }
            });

            $('#player_create').click(function () {
              if ($('#player_create_form').is(":visible"))
                self.tryPlayerAction(4);

              if ($('#player_name').val() === "")
              {
                app.showPlayerCreate();
                $('#player_name').focus();
              }
            });

// TODO - revise below.
            this.info_callback = function(data) {
              switch(data[0]) {
                  case "timeout":
                      self.addValidationError(null, "Timeout whilst attempting to establish connection to RSO servers.");
                  break;

                  case 'invalidlogin':
                      // Login information was not correct (either username or password)
                      self.addValidationError(null, 'The username or password you entered is incorrect.');
                      //self.getUsernameField().focus();
                  break;

                  case 'userexists':
                      // Attempted to create a new user, but the username was taken
                      self.$loginInfo.text("Disconnected.");
                      self.addValidationError(null, 'The username you entered is not available.');
                  break;

                  case 'playerexists':
                      self.addValidationError(null, 'The playername you entered is not available.');
                  break;

                  case 'invalidusername':
                      // The username contains characters that are not allowed (rejected by the sanitizer)
                      self.addValidationError(null, 'The username you entered contains invalid characters.');
                  break;

                  case 'loggedin':
                      // Attempted to log in with the same user multiple times simultaneously
                      self.addValidationError(null, 'A player with the specified username is already logged in.');
                  break;

                  case 'ban':
                      self.addValidationError(null, 'You have been banned.');
                  break;

                  case 'full':
                      self.addValidationError(null, "All RRO2 gameservers are currently full.")
                  break;

                  default:
                      self.addValidationError(null, 'Failed to launch the game: ' + (result.reason ? result.reason : '(reason unknown)'));
                  break;
              }

            };

            this.start();
            this.connect();
        },

      connect: function() {
        //var self = this;
        //var callback = self.userClient;
        config.waitForConfig(this.userClient.bind(this));
      },

      userClient: function () {
        var self = this;
        this.userclient = new UserClient(config.build, this.useServer);

        this.userclient.fail_callback = function(reason){
            self.info_callback({
                success: false,
                reason: reason
            });
            self.started = false;
        };
      },

        setGame: function(game) {
            game.client = game.client;

            this.isMobile = game.renderer.mobile;
            this.isTablet = game.renderer.tablet;
            this.isDesktop = !(this.isMobile || this.isTablet);
            this.supportsWorkers = !!window.Worker;
            this.ready = true;

            this.initMenuButton();
            this.initCombatBar();
        },

        initFormFields: function() {
            var self = this;

            this.getLoadUserButton = function() { return $('#user_load'); };
            this.getCreateUserButton = function() { return $('#user_create'); };
            this.getLoadPlayerButton = function() { return $('#player_load'); };
            this.getCreatePlayerButton = function() { return $('#player_create'); };
            this.getBackButton = function() { return $('#player_cancel'); };


            // Login form fields
            this.$usernameinput = $('#user_name');
            this.$userpasswordinput = $('#user_password');
            this.userFormFields = [this.$usernameinput, this.$userpasswordinput];


            // Create new character form fields
            this.$playernameinput = $('#player_name');
            this.playerFormFields = [this.$playernameinput];

        },

        center: function() {
            window.scrollTo(0, 1);
        },

        tryUserAction: function (action)
        {
          if(this.starting) return;        // Already loading
          var self = this;

          if (action > 0)
          {
            var username = this.$usernameinput.val();
            var userpw = (action === 3) ? $('#remove_password').val() : this.$userpasswordinput.val();
    		    var hash = null;
    		    if (userpw === '')
    		    	hash = $('#user_hash').val();
    		    log.info("hash="+hash);

            if(!this.validateUserForm(username, userpw)) return;

            user = this.user = new User(this.userclient, username, userpw);
            this.userclient.user = this.user;
            //user.rpassword = $('#remove_password').val();

            if ($('#user_save').is(':checked'))
            {
              localforage.setItem('user_name', username);
              localforage.setItem('user_hash', this.user.hash);
            }

            if (action === 1)
              this.userclient.sendLoginUser(this.user);
            if (action === 2)
              this.userclient.sendCreateUser(this.user);
            if (action === 3)
              this.userclient.sendRemoveUser(this.user);
          }
        },

        tryPlayerAction: function(action) {
          if(this.starting) return;        // Already loading

          var self = this;

          if (action === 3 || action === 4)
          {
    		    var username = this.$playernameinput.val();
            var playerIndex = parseInt($('#player_select').val());
            if(action === 4 && !this.validatePlayerForm(username)) return;

    		    //var pClass = parseInt($('#player_class').val());
            var server = parseInt($('#player_server').val());

            var ps = null;
            if (action === 3) {
              this.userclient.sendLoginPlayer(server, playerIndex);
              ps = user.playerSum[playerIndex];
            }
            if (action === 4) {
              this.userclient.sendCreatePlayer(server, username);
              ps = new PlayerSummary(user.playerSum.length, {name: username});
            }
            if (ps)
    		      this.startGame(server, ps);
          }
        },

        startGame: function(server, ps) {
            var self = this;

            $('#gameheading').css('display','none');

            if (game.started)
              return;

            log.debug("Starting game with build config.");

            game.useServer = server;

            this.center();

            game.run(server, ps);
            game.start();
        },

        start: function() {
            var self = this;
            this.getLoadUserButton().click(function () {
              if ($("#user_load").hasClass("loading"))
                return;
              self.tryUserAction(1);
            });
            this.getCreateUserButton().click(function () {
              if ($("#user_create").hasClass("loading"))
                return;
              self.tryUserAction(2);
            });
            this.getLoadPlayerButton().click(function () { self.tryPlayerAction(3); });
            //this.getCreatePlayerButton().click(function () {});
            this.getBackButton().click(function () {
              if ($('#player_load').is(":visible"))
                self.loadWindow('player_window', 'user_window');
              else {
                self.showPlayerLoad();
              }
            })
        },

        showPlayerLoad: function ()
        {
          $('#player_load').show();
          $('#player_select').show();
          $('#lbl_player_select').show();
          $('#player_create_form').hide();
        },

        showPlayerCreate: function ()
        {
          $('#player_load').hide();
          $('#player_select').hide();
          $('#lbl_player_select').hide();
          $('#player_create_form').show();
        },

        userFormActive: function() {
            return $('#user_window').is(":visible");
        },

        playerFormActive: function() {
            return $('#player_window').is(":visible");
        },

        /**
         * Performs some basic validation on the login / create new character forms (required fields are filled
         * out, passwords match, email looks valid). Assumes either the login or the create new character form
         * is currently active.
         */

        validateUserForm: function(username, userpw) {
            this.clearValidationErrors();

            if(!username) {
                this.addValidationError(this.$usernameinput, 'Please enter a username.');
                return false;
            }
            if (username.length < 2 && username.length > 16)
            {
              this.addValidationError(this.$usernameinput, 'Please enter a username between 2 and 16 characters.');
              return false;
            }
            if (username === username.replace(/^[A-Za-z0-9]+$/,''))
            {
              this.addValidationError(this.$usernameinput, 'Please enter username alpha numeric characters only.');
              return false;
            }

            if (userpw.length > 0)
            {
              if (userpw.length < 6 && userpw.length > 16)
              {
                this.addValidationError(this.$userpasswordinput, 'Please enter a username between 6 and 16 characters.');
                return false;
              }
              if (userpw === userpw.replace(/^[A-Za-z0-9@!#\$\^%&*()+=\-\[\]\\\';\.\/\{\}\|\":<>\? ]+$/,''))
              {
                this.addValidationError(this.$userpasswordinput, 'Please enter password alpha numeric, and special characters only.');
                return false;
              }
            }
            return true;
        },

        validatePlayerForm: function(playername) {
            this.clearValidationErrors();

            if(!playername) {
                this.addValidationError(this.$playernameinput, 'Please enter a player name.');
                return false;
            }
            if (playername.length < 2 && playername.length > 16)
            {
              this.addValidationError(this.$playernameinput, 'Please enter a player name between 2 and 16 characters.');
              return false;
            }
            if (playername === playername.replace(/^[A-Za-z0-9]+$/,''))
            {
              this.addValidationError(this.$playernameinput, 'Please enter player name alpha numeric characters only.');
              return false;
            }

            return true;
        },

        addValidationError: function(field, errorText) {
            $('.validation-summary').html('');
            $('<span/>', {
                'class': 'validation-error blink',
                text: errorText
            }).appendTo('.validation-summary');

            if(field) {
                field.addClass('field-error').select();
                field.keypress(function (event) {
                    field.removeClass('field-error');
                    $('.validation-error').remove();
                    $(this).unbind(event);
                });
            }
        },

        clearValidationErrors: function() {
            //var fields = this.loginFormActive() ? this.loginFormFields : this.createNewCharacterFormFields;
            var fields;
            if (this.userFormActive())
            	    fields = this.userFormFields;
            else if (this.playerFormActive())
            	    fields = this.playerFormFields;

            if (fields)
            {
      		    $.each(fields, function(i, field) {
          			if (field.hasClass('field-error'))
          			    field.removeClass('field-error');
          		    });
      		    $('.validation-error').remove();
            }
        },

        getZoom: function() {
            var zoom = game.renderer.zoom * game.renderer.scaleHUD;
            return zoom;
        },


        setMouseCoordinates: function(x, y) {
            // TODO Width and Height not clamping mouse properly.
            var scale = game.renderer.scale,
                width = game.renderer.innerWidth,
                height = game.renderer.innerHeight,
                mouse = game.mouse;

            var zoom = 1/game.renderer.resolution;

            width = ~~(width/zoom)-1;
            height = ~~(height/zoom)-1;

            mouse.x = ~~(clamp(x,0,width)*zoom/scale);
            mouse.y = ~~(clamp(y,0,height)*zoom/scale);

            //log.info(mouse.x+","+mouse.y);
        },

        initPlayerBar: function() {
            var self = this;
            var player = game.player;

            if (player && !Detect.isMobile()) {
              var anim = new PlayerAnim();
              anim.sprites = [];
              anim.addSprite(player.getArmorSprite());
              anim.addSprite(player.getWeaponSprite());
              anim.setHTML(['#characterLookArmor2','#characterLookWeapon2']);
              anim.showHTML('#characterLook2', 2, 2);
              anim.idle(Types.Orientations.DOWN);
              anim.show();
            }
        },

        npcDialoguePic: function (entity) {
            var jqPic = $("#npcDialoguePic");
            var scale = 2;

    		    var sprite = entity.sprite;

            var anim = entity.sprite.animations["idle_down"];
            var oc = anim.col * anim.width * scale;
            var or = anim.row * anim.height * scale;
    		    width2 = sprite ? sprite.width * scale : 0;
    		    height2 = sprite ? sprite.height * scale : 0;

    		    jqPic.css('width', '' + ~~(width2) + 'px');
    		    jqPic.css('height', '' + ~~(height2*0.75) + 'px');
    		    jqPic.css('background-position', '-'+ ~~(oc) +'px -' + ~~(or) + 'px');
            jqPic.css('transform','scale(1.5)')

    		    jqPic.css('background-image', 'url("'+sprite.filepath+'")');
        },

        //Init the hud that makes it show what creature you are mousing over and attacking
        initTargetHud: function(){
          var self = this;
          var scale = game.renderer.getScaleFactor(),
              guiScale = game.renderer.getUiScaleFactor(),
          	  zoom = game.renderer.zoom,
              timeout,
              ts = game.renderer.tilesize;

          if (game.player) {
		        game.player.onSetTarget(function(target, name, level, mouseover)
            {
  		        var el = '#target';

        			if (target.title)
        			{
        				$(el+' .name').text(target.title);
        			}
        			else
        			{
        				$(el+' .name').text(name + "Lv"+level);
        			}

        			$(el+' .name').css('text-transform', 'capitalize');
        			if(target.healthPoints) {
        			    $(el+" .health").css('width', Math.round(target.healthPoints/target.maxHp*40*guiScale)+'px');
        			} else{
        			    $(el+" .health").css('width', 40*guiScale+"px");
        			}

        			$(el).fadeIn('fast');
		        });
          }

          game.onUpdateTarget(function(target){
          	log.info("targetHealth: "+target.healthPoints+" "+target.maxHp);
              //$("#target .health").css('width', Math.round(target.healthPoints/target.maxHp*90*scale)+'px');
              $("#target .health").css('width', Math.round(target.healthPoints/target.maxHp*40*guiScale)+'px');
              /*if(game.player.inspecting && game.player.inspecting.id === target.id){
                  $("#inspector .health").css('width', Utils.Percent(target.healthPoints/target.maxHp, 0));
              }*/
          });

          if (game.player) {
    		    game.player.onRemoveTarget( function(targetId) {
      			$('#target').fadeOut('fast');
      			$("#target .health").css('width', (40*guiScale)+'px');

      			$('#combatContainer').fadeOut('fast');
		        });
          }
        },

        initEnergyBar: function() {
            var maxWidth = $("#statbars").width();

            game.onPlayerEnergyChange(function(ep, epMax) {
                maxWidth = $("#statbars").width();
                var barWidth = Math.round((maxWidth / epMax) * (ep > 0 ? ep : 0));
                //$('#energy').css('width', barWidth + "px");
                //$('#energytext').html("<p>Energy: " + ep + "/" + epMax + "</p>");
            });
        },

        initExpBar: function(){
            var maxWidth = parseInt($('#expbar').width());
			      var widthRate = 1.0;
            var self = this;

            jqExp = $('#exp');
            jqExpBar = $('#expbar');
            jqExpLevel = $('#explevel');
            game.onPlayerExpChange(function(level, exp){
              var prevLvlExp = Types.expForLevel[level-1];
              var expInThisLevel = exp - prevLvlExp;
              var expForLevelUp = Types.expForLevel[level] - prevLvlExp;

            	if (!expInThisLevel && !expForLevelUp)
            	{
            		jqExp.css('width', "0px");
            		jqExpBar.attr("title", "Exp: 0%");
               	jqExpBar.html("Exp: 0%");
               	return;
              }

              maxWidth = parseInt($('#expbar').width());
            	var rate = expInThisLevel/expForLevelUp;
              if(rate > 1){
                  rate = 1;
              } else if(rate < 0){
                  rate = 0;
              }

              var rateFmt = Utils.Percent(rate,0);
              jqExp.css('width', rateFmt);
             	jqExpBar.attr("title", "Exp: " + rateFmt);
             	jqExpBar.html("Exp: " + rateFmt);
             	jqExpLevel.html(level);
            });
        },

        initHealthBar: function() {
      	    var healthMaxWidth = $("#statbars").width();
	          log.info("healthMaxWidth="+healthMaxWidth);

            var jqHealth = $("#health");
            var jqHealthText = $('#healthtext');

            game.onPlayerHealthChange(function(hp, maxHp) {
                healthMaxWidth = $("#statbars").width();
                var barWidth = Math.round((healthMaxWidth / maxHp) * (hp > 0 ? hp : 0));
                jqHealth.css('width', barWidth + "px");
                jqHealthText.html("<p>HP: " + hp + "/" + maxHp + "</p>");
            });

            game.onPlayerHurt(this.blinkHealthBar.bind(this));
        },


        blinkHealthBar: function() {
            var $hitpoints = $('#health');

            $hitpoints.addClass('white');
            setTimeout(function() {
                $hitpoints.removeClass('white');
            }, 500);
        },

        initMenuButton: function() {
        	var self = this;
        	log.info("initMenuButton");

    			$( document ).ready(function() {
    				$("#menucontainer").css("display", "none");
    			});

        	$("#charactermenu").click(function(e) {
        		if ($("#menucontainer").is(':visible'))
        		{
        			$("#menucontainer").fadeOut();
    				}
    				else
    				{
    					$("#menucontainer").show();
    				}
        	});

          $(window).resize(function() {
            app.resizeUi();
          });

    			$( document ).ready(function() {
    				$("#menucontainer").on('click', 'div', function(e){
    					$("#menucontainer").fadeOut();
    				});
    			});

        	$("#menucontainer").click(function(e){
				    $("#menucontainer").fadeOut();
        	});
        },

        initCombatBar: function () {
        	var container = "#combatContainer";
      		$(container).children().click(function(e) {
      			$(container).children().removeClass('lightup');
      			$(this).addClass("lightup");
      		});
      		$(container).children().eq(1).addClass("lightup");
        },

        hideIntro: function() {
            clearInterval(this.watchNameInputInterval);
            $('body').removeClass('intro');
            setTimeout(function() {
                $('body').addClass('game');
            }, 500);
        },

        showChat: function(flag) {
            if(game.started) {
              if (flag) {
                $('#chatbox').addClass('active');
                $('#chatinput').focus();
                //$('#chatbutton').addClass('active');
                $('#chatbutton').addClass('active');
              }
              else {
                $('#chatbox').removeClass('active');
                $('#chatinput').blur();
                //$('#chatbutton').removeClass('active');
                $('#chatbutton').removeClass('active');
              }
            }
        },

        showChatLog: function() {
            if(game.started) {
                $('#chatbutton').addClass('active');
                $('#chatLog').hide();
            }
        },

        hideChatLog: function() {
            if(game.started) {
                $('#chatbutton').removeClass('active');
                $('#chatLog').css('display','flex');
            }
        },

        showDropDialog: function(dropAction) {
          if(game.started) {
            $('#dropDialog').show();
            $('#dropCount').focus();
            $('#dropCount').select();

            this.dropAction = dropAction;
            this.dropDialogPopuped = true;
          }
        },
        hideDropDialog: function() {
          if(game.started) {
            $('#dropDialog').hide();
            //$('#dropCount').blur();

            this.dropDialogPopuped = false;
          }
        },


        showAuctionSellDialog: function(inventoryNumber) {
          if(game.started) {
            $('#auctionSellDialog').show();
            $('#auctionSellCount').focus();
            $('#auctionSellCount').select();

            this.inventoryNumber = inventoryNumber;
            this.auctionsellDialogPopuped = true;
          }
        },
        hideAuctionSellDialog: function() {
          if(game.started) {
            $('#auctionSellDialog').hide();
            //$('#auctionSellCount').blur();

            this.auctionsellDialogPopuped = false;
          }
        },

        hideWindows: function() {
        },

        loadWindow: function(origin, destination) {
        	$('#'+origin).hide();
        	$('#'+destination).show();
          //$('#'+destination).focus();
          if (destination !== "user_window") {
            $('#aboutbutton').hide();
          }
          if (destination === "player_window")
            $('#user_remove').show();
          this.initFormFields();
        },

        resizeUi: function() {
            //log.error("resizeUi");
            if(game && game.started) {
              game.resize(game.zoom);
              this.initHealthBar();
              this.initTargetHud();
              this.initExpBar();
              this.initPlayerBar();
              game.updateBars();
            }
        },

        onUserReady: function () {
          app.userReady = true;
          $('#user_create').removeClass('loading');
          $('#user_load').removeClass('loading');
          app.$loginInfo.text("Connected.");
        }
    });

    return App;
});

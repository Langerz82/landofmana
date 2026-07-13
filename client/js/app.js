// Converted from AMD (define) + Class.extend to a native ES6 module/class.
// NOTE: 'lib/localforage.js' is a UMD/browserify bundle (checks for CommonJS `module.exports`,
// then AMD `define.amd`, then falls back to `window.localforage = ...`). It has no ES `export`
// of its own, so it can't be given a named/default binding - but since neither `module`/`exports`
// nor a RequireJS-style `define` exist in this native-ES-module setup, importing it purely for
// its side effect still correctly falls through to the `window.localforage` branch, exactly as
// it did as a classic <script> tag. This is the earliest point in the import graph
// (main.js imports App before Game), so it's imported here once rather than in every consumer.
/* global Mob, Item, Types, Utils, log, _, TRANSITIONEND, Class, localforage */
import Detect from './detect.js';
import Mob from './entity/mob.js';
import Item from './entity/item.js';
import MobData from './data/mobdata.js';
import User, { PlayerSummary } from './user.js';
import UserClient from './userclient.js';
import config from './config.js';
import PlayerAnim from './playeranim.js';
import './lib/localforage.js';

export default class App {
        constructor() {
            window.app = this; // FIX (conversion): was a bare `app = this` assignment; this is the canonical declaration site for the cross-file `app` global, made explicit for ES module strict mode (see js/globalstate.js for the same pattern applied to other legacy shared globals)

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
      			     // FIX: .value is a no-op on a jQuery object; use .val() to actually set the field
      			     $('#user_hash').val(val);
      		   });
      		   localforage.getItem('user_name', function(e, val) {
      		   	   log.info("val="+val);
      			     // FIX: .value is a no-op on a jQuery object; use .val() to actually set the field
      			     $('#user_name').val(val);
      		   });
      		   // FIX: .value is a no-op on a jQuery object; use .val() to actually set the field
      		   $('#user_password').val("");

		        const self = this;

            $( document ).ready(function() {
              self.jqUserWindow = $('#user_window');
              self.jqPlayerWindow = $('#player_window');

              self.jqPlayerSelect = $("#player_select");
              self.jqPlayerLoad = $("#player_load");
              self.jqPlayerCreate = $("#player_create");
              self.jqPlayerCreateForm = $('#player_create_form');
      			});

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
              const rpawd = $('#remove_confirm').val();
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
              self.jqPlayerCreateForm.hide();
              self.jqPlayerLoad.hide();
              self.jqPlayerCreate.show();
            });

            $('#player_select').change(function () {
              if ($(this).val() === -1)
              {
                self.jqPlayerLoad.hide();
                self.jqPlayerCreate.show();
                self.jqPlayerCreateForm.show();
              }
              else
              {
                self.jqPlayerLoad.show();
                self.jqPlayerCreateForm.hide();
              }
            });

            $('#player_create').click(function () {
              if (self.jqPlayerLoad.hasClass("loading"))
                return;

              if (self.jqPlayerCreate.hasClass("loading"))
                return;

              if (self.jqPlayerCreateForm.is(":visible"))
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
                      // FIX: `result` was not in scope here (would throw ReferenceError); use `data[0]`, the switch's own subject
                      self.addValidationError(null, 'Failed to launch the game: ' + (data[0] ? data[0] : '(reason unknown)'));
                  break;
              }

            };

            this.start();
            this.connect();
        }

      connect() {
        //var self = this;
        //var callback = self.userClient;
        config.waitForConfig(this.userClient.bind(this));
      }

      userClient() {
        const self = this;
        this.userclient = new UserClient(config.build, this.useServer);

        this.userclient.fail_callback = function(reason){
            self.info_callback({
                success: false,
                reason: reason
            });
            self.started = false;
        };
      }

        setGame(game) {
            game.client = game.client;

            this.isMobile = game.renderer.mobile;
            this.isTablet = game.renderer.tablet;
            this.isDesktop = !(this.isMobile || this.isTablet);
            this.supportsWorkers = !!window.Worker;
            this.ready = true;

            this.initMenuButton();
            this.initCombatBar();
        }

        initFormFields() {
            const self = this;

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

        }

        center() {
            window.scrollTo(0, 1);
        }

        tryUserAction(action)
        {
          if(this.starting) return;        // Already loading
          const self = this;

          if (action > 0)
          {
            const username = this.$usernameinput.val();
            const userpw = (action === 3) ? $('#remove_password').val() : this.$userpasswordinput.val();
    		    let hash = null;
    		    if (userpw === '')
    		    	hash = $('#user_hash').val();
    		    log.info("hash="+hash);

            if(!this.validateUserForm(username, userpw)) return;

            const user = this.user = new User(this.userclient, username, userpw);
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
        }

        tryPlayerAction(action) {
          if(this.starting) return;        // Already loading

          if (action === 3 || action === 4)
          {
            this.jqPlayerLoad.addClass("loading");
            this.jqPlayerCreate.addClass("loading");

    		    const username = this.$playernameinput.val();
            const playerIndex = parseInt(this.jqPlayerSelect.val());
            if(action === 4 && !this.validatePlayerForm(username)) return;

    		    //var pClass = parseInt($('#player_class').val());
            const server = parseInt($('#player_server').val());

            let ps = null;
            if (action === 3) {
              this.userclient.sendLoginPlayer(server, playerIndex);
              ps = this.user.playerSum[playerIndex];
            }
            if (action === 4) {
              this.userclient.sendCreatePlayer(server, username);
              // FIX: bare `user` referenced an undeclared identifier (ReferenceError under ES module strict mode); this.user is the User instance created in tryUserAction
              ps = new PlayerSummary(this.user.playerSum.length, {name: username});
            }
            if (ps)
    		      this.startGame(server, ps);
          }
        }

        startGame(server, ps) {
            const self = this;

            $('#gameheading').css('display','none');

            if (game.started)
              return;

            log.debug("Starting game with build config.");

            game.useServer = server;

            this.center();

            game.run(server, ps);
            game.start();
        }

        start() {
            const self = this;
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
            this.getLoadPlayerButton().click(function () {
              if (self.jqPlayerLoad.hasClass("loading"))
                return;
              if (self.jqPlayerCreate.hasClass("loading"))
                return;

              //self.jqPlayerLoad.addClass("loading");
              //self.jqPlayerCreate.addClass("loading");
              self.tryPlayerAction(3);
            });
            //this.getCreatePlayerButton().click(function () {});
            this.getBackButton().click(function () {
              if (self.jqPlayerLoad.is(":visible"))
                self.loadWindow('player_window', 'user_window');
              else {
                self.showPlayerLoad();
              }
            })
        }

        showPlayerLoad()
        {
          this.jqPlayerLoad.show();
          this.jqPlayerSelect.show();
          $('#lbl_player_select').show();
          this.jqPlayerCreateForm.hide();
        }

        showPlayerCreate()
        {
          this.jqPlayerLoad.hide();
          this.jqPlayerSelect.hide();
          $('#lbl_player_select').hide();
          this.jqPlayerCreateForm.show();
        }

        userFormActive() {
            return this.jqUserWindow.is(":visible");
        }

        playerFormActive() {
            return this.jqPlayerWindow.is(":visible");
        }

        /**
         * Performs some basic validation on the login / create new character forms (required fields are filled
         * out, passwords match, email looks valid). Assumes either the login or the create new character form
         * is currently active.
         */

        validateUserForm(username, userpw) {
            this.clearValidationErrors();

            if(!username) {
                this.addValidationError(this.$usernameinput, 'Please enter a username.');
                return false;
            }
            // FIX: `&&` made this condition impossible to hit (length can't be both <2 and >16); use `||` so it actually rejects bad lengths
            if (username.length < 2 || username.length > 16)
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
              // FIX: `&&` made this condition impossible to hit (length can't be both <6 and >32); use `||` so it actually rejects bad lengths
              if (userpw.length < 6 || userpw.length > 32)
              {
                this.addValidationError(this.$userpasswordinput, 'Please enter a user password between 6 and 32 characters.');
                return false;
              }
              if (userpw === userpw.replace(/^[A-Za-z0-9@!#\$\^%&*()+=\-\[\]\\\';\.\/\{\}\|\":<>\? ]+$/,''))
              {
                this.addValidationError(this.$userpasswordinput, 'Please enter password alpha numeric, and special characters only.');
                return false;
              }
            }
            return true;
        }

        validatePlayerForm(playername) {
            this.clearValidationErrors();

            if(!playername) {
                this.addValidationError(this.$playernameinput, 'Please enter a player name.');
                return false;
            }
            // FIX: `&&` made this condition impossible to hit (length can't be both <2 and >16); use `||` so it actually rejects bad lengths
            if (playername.length < 2 || playername.length > 16)
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
        }

        addValidationError(field, errorText) {
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
        }

        clearValidationErrors() {
            //var fields = this.loginFormActive() ? this.loginFormFields : this.createNewCharacterFormFields;
            let fields;
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
        }

        getZoom() {
            const zoom = game.renderer.zoom * game.renderer.scaleHUD;
            return zoom;
        }

        setMouseCoordinates(x, y) {
            // TODO Width and Height not clamping mouse properly.
            //console.info("app.setMouseCoordinates - x:"+x+",y"+y);

            const r = game.renderer;
            let scale = r.scale,
                width = r.innerWidth,
                height = r.innerHeight,
                mouse = game.mouse;

            const zoom = 1/r.resolution;

            width = ~~(width/zoom)-1;
            height = ~~(height/zoom)-1;

            mouse.x = ~~(Utils.clamp(0,width,x)*zoom/scale);
            mouse.y = ~~(Utils.clamp(0,height,y)*zoom/scale);

            //console.info("app.setMouseCoordinates - mouse.x:"+mouse.x+",mouse.y"+mouse.y);
        }


        initPlayerBar() {
            const self = this;
            const player = game.player;

            if (player && !Detect.isMobile()) {
              const anim = new PlayerAnim();
              anim.sprites = [];
              anim.addSprite(player.getSprite(0));
              anim.addSprite(player.getSprite(1));
              anim.setHTML(['#characterLookArmor2','#characterLookWeapon2']);
              anim.showHTML('#characterLook2', 2, 2);
              anim.idle(Types.Orientations.DOWN);
              anim.show();
            }
        }

        npcDialoguePic(entity) {
            const jqPic = $("#npcDialoguePic");
            const scale = 2;

    		    const sprite = entity.getSprite();
            // FIX: sprite.animations was dereferenced before the sprite-null checks below ran,
            // so a falsy sprite (e.g. not loaded yet) threw instead of no-oping like the rest
            // of this function was clearly designed to handle
            if (!sprite) return;

            const anim = sprite.animations["idle_down"];
            const oc = anim.col * anim.width * scale;
            const or = anim.row * anim.height * scale;
    		    const width2 = sprite.width * scale;
    		    const height2 = sprite.height * scale;

    		    jqPic.css('width', '' + ~~(width2) + 'px');
    		    jqPic.css('height', '' + ~~(height2*0.75) + 'px');
    		    jqPic.css('background-position', '-'+ ~~(oc) +'px -' + ~~(or) + 'px');
            jqPic.css('transform','scale(1.5)')

    		    jqPic.css('background-image', 'url("'+sprite.filepath+'")');
        }

        //Init the hud that makes it show what creature you are mousing over and attacking
        initTargetHud(){
          const self = this;
          let scale = game.renderer.getScaleFactor(),
              guiScale = game.renderer.getUiScaleFactor(),
          	  zoom = game.renderer.zoom,
              timeout,
              ts = game.renderer.tilesize;

          if (game.player) {
		        game.player.onSetTarget(function(target, mouseover)
            {
              let targetName = target.name;
              if (!(targetName && target.hasOwnProperty("stats") &&
                target.stats.hasOwnProperty("hpMax") && target.stats.hpMax > 0))
              {
                return;
              }

              const mobData = MobData.Kinds[target.kind];
              if (target instanceof Mob && mobData)
              {
              	  if (mobData.name)
              	      targetName = mobData.name;
                  else
                      targetName = mobData.key;
              }

  		        const el = '#target';

              targetName = targetName.capitalizeFirstLetter();
        			$(el+' .name').text(targetName + " Lv"+target.level);

        			//$(el+' .name').css('text-transform', 'capitalize');

        			if(target.stats.hp) {
        			    $("#target-health").css('width', Math.round(target.stats.hp/target.stats.hpMax*60*guiScale)+'px');
                  $("#target-healthtext").html("HP: "+target.stats.hp + "/" + target.stats.hpMax);
        			} else{
        			    $("#target-health").css('width', 60*guiScale+"px");
        			}

        			$(el).fadeIn('fast');
	        });
          }

          game.onUpdateTarget(function(target){
          	log.info("targetHealth: "+target.stats.hp+" "+target.stats.hpMax);
              //$("#target .health").css('width', Math.round(target.healthPoints/target.maxHp*90*scale)+'px');
              $("#target-health").css('width', Math.round(target.stats.hp/target.stats.hpMax*60*guiScale)+'px');
              $("#target-healthtext").html("HP: "+target.stats.hp + "/" + target.stats.hpMax);
              /*if(game.player.inspecting && game.player.inspecting.id === target.id){
                  $("#inspector .health").css('width', Utils.Percent(target.healthPoints/target.maxHp, 0));
              }*/
          });

          if (game.player) {
    		    game.player.onRemoveTarget( function(targetId) {
      			$('#target').fadeOut('fast');
      			$("#target .health").css('width', (60*guiScale)+'px');

      			$('#combatContainer').fadeOut('fast');
	        });
          }
        }

        initExpBar(){
            let maxWidth = parseInt($('#expbar').width());
			      const widthRate = 1.0;
            const self = this;

            const jqExp = $('#exp');
            const jqExpBar = $('#expbar');
            const jqExpLevel = $('#explevel');

            game.onPlayerExpChange(function(level, exp){
              const prevLvlExp = Types.expForLevel[level-1];
              const expInThisLevel = exp - prevLvlExp;
              const expForLevelUp = Types.expForLevel[level] - prevLvlExp;

            	if (!expInThisLevel && !expForLevelUp)
            	{
            		jqExp.css('width', "0px");
            		jqExpBar.attr("title", "Exp: 0%");
               	jqExpBar.html("Exp: 0%");
               	return;
              }

              maxWidth = parseInt($('#expbar').width());
            	let rate = expInThisLevel/expForLevelUp;
              if(rate > 1){
                  rate = 1;
              } else if(rate < 0){
                  rate = 0;
              }

              const rateFmt = Utils.Percent(rate,0);
              jqExp.css('width', rateFmt);
             	jqExpBar.attr("title", "Exp: " + rateFmt);
             	jqExpBar.html("Exp: " + rateFmt);
             	jqExpLevel.html(level);
            });
        }

        initHealthBar() {
      	    let healthMaxWidth = $("#statbars").width();
	          log.info("healthMaxWidth="+healthMaxWidth);

            const jqHealth = $("#health");
            const jqHealthText = $('#healthtext');

            game.onPlayerHealthChange(function(hp, maxHp) {
                healthMaxWidth = $("#statbars").width();
                const barWidth = Math.round((healthMaxWidth / maxHp) * (hp > 0 ? hp : 0));
                jqHealth.css('width', barWidth + "px");
                jqHealthText.html("HP: " + hp + "/" + maxHp);
            });

            game.onPlayerHurt(this.blinkHealthBar.bind(this));
        }

        blinkHealthBar() {
            const $hitpoints = $('#health');

            $hitpoints.addClass('white');
            setTimeout(function() {
                $hitpoints.removeClass('white');
            }, 500);
        }

        initMenuButton() {
        	const self = this;
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
        }

        initCombatBar() {
        	const container = "#combatContainer";
      		$(container).children().click(function(e) {
      			$(container).children().removeClass('lightup');
      			$(this).addClass("lightup");
      		});
      		$(container).children().eq(1).addClass("lightup");
        }

        hideIntro() {
            clearInterval(this.watchNameInputInterval);
            $('body').removeClass('intro');
            setTimeout(function() {
                $('body').addClass('game');
            }, 500);
        }

        showChat(flag) {
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
        }

        showChatLog() {
            if(game.started) {
                $('#chatbutton').addClass('active');
                $('#chatLog').hide();
            }
        }

        hideChatLog() {
            if(game.started) {
                $('#chatbutton').removeClass('active');
                $('#chatLog').css('display','flex');
            }
        }

        showDropDialog(dropAction) {
          if(game.started) {
            $('#dropDialog').show();
            $('#dropCount').focus();
            $('#dropCount').select();

            this.dropAction = dropAction;
            this.dropDialogPopuped = true;
          }
        }
        hideDropDialog() {
          if(game.started) {
            $('#dropDialog').hide();
            //$('#dropCount').blur();

            this.dropDialogPopuped = false;
          }
        }


        showAuctionSellDialog(inventoryNumber) {
          if(game.started) {
            $('#auctionSellDialog').show();
            $('#auctionSellCount').focus();
            $('#auctionSellCount').select();

            this.inventoryNumber = inventoryNumber;
            this.auctionsellDialogPopuped = true;
          }
        }
        hideAuctionSellDialog() {
          if(game.started) {
            $('#auctionSellDialog').hide();
            //$('#auctionSellCount').blur();

            this.auctionsellDialogPopuped = false;
          }
        }

        hideWindows() {
        }

        loadWindow(origin, destination) {
        	$('#'+origin).hide();
        	$('#'+destination).show();
          //$('#'+destination).focus();
          if (destination !== "user_window") {
            $('#aboutbutton').hide();
          }
          if (destination === "player_window")
            $('#user_remove').show();
          this.initFormFields();
        }

        resizeUi() {
            //log.error("resizeUi");
            if(game && game.started) {
              game.resize(game.zoom);
              this.initHealthBar();
              this.initTargetHud();
              this.initExpBar();
              this.initPlayerBar();
              game.updateBars();
            }
        }

        onUserReady() {
          app.userReady = true;
          $('#user_create').removeClass('loading');
          $('#user_load').removeClass('loading');
          app.$loginInfo.text("Connected.");
        }
}

// Mixin extracted from app.js: HUD/dialog setup and show/hide: player bars, target HUD, menu/combat bar init, chat/drop/auction dialogs, window show/hide, resize.
// Applied onto App.prototype via install*(...) call in app.js; not a standalone class.
import Detect from '../detect.js';
import Mob from '../entity/mob.js';
import MobData from '../data/mobdata.js';
import PlayerAnim from '../playeranim.js';
/* global Utils, log, game, app */

export function installAppUI(proto) {

        proto.center = function() {
            window.scrollTo(0, 1);
        };


        proto.showPlayerLoad = function()
        {
          this.jqPlayerLoad.show();
          this.jqPlayerSelect.show();
          $('#lbl_player_select').show();
          this.jqPlayerCreateForm.hide();
        };


        proto.showPlayerCreate = function()
        {
          this.jqPlayerLoad.hide();
          this.jqPlayerSelect.hide();
          $('#lbl_player_select').hide();
          this.jqPlayerCreateForm.show();
        };


        proto.getZoom = function() {
            const zoom = game.renderer.zoom * game.renderer.scaleHUD;
            return zoom;
        };


        proto.setMouseCoordinates = function(x, y) {
            // TODO Width and Height not clamping mouse properly.

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

        };



        proto.initPlayerBar = function() {
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
        };


        proto.npcDialoguePic = function(entity) {
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
        };


        //Init the hud that makes it show what creature you are mousing over and attacking
        proto.initTargetHud = function(){
          const guiScale = game.renderer.getUiScaleFactor();

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
              $("#target-health").css('width', Math.round(target.stats.hp/target.stats.hpMax*60*guiScale)+'px');
              $("#target-healthtext").html("HP: "+target.stats.hp + "/" + target.stats.hpMax);
          });

          if (game.player) {
    		    game.player.onRemoveTarget( function(targetId) {
      			$('#target').fadeOut('fast');
      			$("#target .health").css('width', (60*guiScale)+'px');

      			$('#combatContainer').fadeOut('fast');
	        });
          }
        };


        proto.initExpBar = function(){
            let maxWidth = parseInt($('#expbar').width());

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
            	const rate = Utils.clamp(0, 1, expInThisLevel/expForLevelUp);

              const rateFmt = Utils.Percent(rate,0);
              jqExp.css('width', rateFmt);
             	jqExpBar.attr("title", "Exp: " + rateFmt);
             	jqExpBar.html("Exp: " + rateFmt);
             	jqExpLevel.html(level);
            });
        };


        proto.initHealthBar = function() {
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
        };


        proto.blinkHealthBar = function() {
            const $hitpoints = $('#health');

            $hitpoints.addClass('white');
            setTimeout(function() {
                $hitpoints.removeClass('white');
            }, 500);
        };


        proto.initMenuButton = function() {
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
        };


        proto.initCombatBar = function() {
        	const container = "#combatContainer";
      		$(container).children().click(function(e) {
      			$(container).children().removeClass('lightup');
      			$(this).addClass("lightup");
      		});
      		$(container).children().eq(1).addClass("lightup");
        };


        proto.hideIntro = function() {
            clearInterval(this.watchNameInputInterval);
            $('body').removeClass('intro');
            setTimeout(function() {
                $('body').addClass('game');
            }, 500);
        };


        proto.showChat = function(flag) {
            if(game.started) {
              if (flag) {
                $('#chatbox').addClass('active');
                $('#chatinput').focus();
                $('#chatbutton').addClass('active');
              }
              else {
                $('#chatbox').removeClass('active');
                $('#chatinput').blur();
                $('#chatbutton').removeClass('active');
              }
            }
        };


        proto.showChatLog = function() {
            if(game.started) {
                $('#chatbutton').addClass('active');
                $('#chatLog').hide();
            }
        };


        proto.hideChatLog = function() {
            if(game.started) {
                $('#chatbutton').removeClass('active');
                $('#chatLog').css('display','flex');
            }
        };


        proto.showDropDialog = function(dropAction) {
          if(game.started) {
            $('#dropDialog').show();
            $('#dropCount').focus();
            $('#dropCount').select();

            this.dropAction = dropAction;
            this.dropDialogPopuped = true;
          }
        };

        proto.hideDropDialog = function() {
          if(game.started) {
            $('#dropDialog').hide();

            this.dropDialogPopuped = false;
          }
        };



        proto.showAuctionSellDialog = function(inventoryNumber) {
          if(game.started) {
            $('#auctionSellDialog').show();
            $('#auctionSellCount').focus();
            $('#auctionSellCount').select();

            this.inventoryNumber = inventoryNumber;
            this.auctionsellDialogPopuped = true;
          }
        };

        proto.hideAuctionSellDialog = function() {
          if(game.started) {
            $('#auctionSellDialog').hide();

            this.auctionsellDialogPopuped = false;
          }
        };


        proto.hideWindows = function() {
        };


        proto.loadWindow = function(origin, destination) {
        	$('#'+origin).hide();
        	$('#'+destination).show();
          if (destination !== "user_window") {
            $('#aboutbutton').hide();
          }
          if (destination === "player_window")
            $('#user_remove').show();
          this.initFormFields();
        };


        proto.resizeUi = function() {
            if(game && game.started) {
              game.resize(game.zoom);
              this.initHealthBar();
              this.initTargetHud();
              this.initExpBar();
              this.initPlayerBar();
              game.updateBars();
            }
        };


        proto.onUserReady = function() {
          app.userReady = true;
          $('#user_create').removeClass('loading');
          $('#user_load').removeClass('loading');
          app.$loginInfo.text("Connected.");
        };

}

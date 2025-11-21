define(['lib/localforage', 'lib/virtualjoystick'], function(localforage) {
  var SettingsHandler = Class.extend({
    init: function(game) {
    	this.game = game;
    	this.app = game.app;
    	this.toggle = false;
    	var self = this;

      var sound = localforage.getSetting

    	$('#settingsclose').click(function(e){
                self.show();
    	});

    	/*$('#buttonsound').click(function(e) {
    		if ($(this).hasClass('active')) {
    			$(this).html("Off");
    			$(this).removeClass('active');
          funcSound(false);
          localforage.setItem('sound', false);
    		}
    		else {
    			$(this).html("On");
    			$(this).addClass('active');
          funcSound(true);
          localforage.setItem('sound', true);
    		}
    	});*/

      this.funcSound = function (bSound)
      {
        if(self.game && self.game.audioManager) {
          self.game.audioManager.toggle(bSound);
        }
      };

      var buttonSound = $('#buttonsound');
      buttonSound.click(function(e) {
        if ($(this).hasClass('active')) {
          $(this).html("Off");
          $(this).removeClass('active');
          self.funcSound(false);
          localforage.setItem('sound', 0);
        }
        else {
          $(this).html("On");
          $(this).addClass('active');
          self.funcSound(true);
          localforage.setItem('sound', 1);
        }
      });


      var funcChat = function (bChat)
      {
        if(self.game) {
    			if(bChat) {
    				app.hideChatLog();
    			} else {
    				app.showChatLog();
    			}
        }
      };

      var buttonChat = $('#buttonchat');
      localforage.getItem('chat', function(e, val) {
        if (!val) {
          buttonChat.html("Off");
    			buttonChat.removeClass('active');
          funcChat(false);
        }
        else {
          buttonChat.html("On");
    			buttonChat.addClass('active');
          funcChat(true);
        }
      });

    	buttonChat.click(function(e) {
    		if ($(this).hasClass('active')) {
    			$(this).html("Off");
    			$(this).removeClass('active');
          funcChat(false);
          localforage.setItem('chat', false);
    		}
    		else {
    			$(this).html("On");
    			$(this).addClass('active');
          funcChat(true);
          localforage.setItem('chat', true);
    		}

      });


      var funcJoystick = function (bJoystick)
      {
        if(self.game) {
          if (bJoystick)
          {
              self.game.usejoystick = true;
              log.info("Loading Joystick");
              self.game.joystick = new VirtualJoystick({
              game            : self.game,
              container		: document.getElementById('canvas'),
              mouseSupport	: true,
              //stationaryBase  : true,
              //baseX : 50 * self.renderer.scale,
              //baseY : $('#container').height() - (60 * self.renderer.scale),

              //limitStickTravel: true,
              //stickRadius: 20 * self.renderer.scale,
              });
          }
          else
          {
            self.game.usejoystick = false;
            self.game.joystick = null;
            VirtualJoystick._touchIdx = null;
          }
        }
      };

      var buttonJoystick = $('#buttonjoystick');
      localforage.getItem('joystick', function(e, val) {
        if (!val) {
          buttonJoystick.html("Off");
    			buttonJoystick.removeClass('active');
          funcJoystick(false);
        }
        else {
          buttonJoystick.html("On");
    			buttonJoystick.addClass('active');
          funcJoystick(true);
        }
      });

    	buttonJoystick.click(function(e) {
    		if ($(this).hasClass('active')) {
    			$(this).html("Off");
    			$(this).removeClass('active');
          funcJoystick(false);
          localforage.setItem('joystick', false);
    		}
    		else {
    			$(this).html("On");
    			$(this).addClass('active');
          funcJoystick(true);
          localforage.setItem('joystick', true);
    		}
      });

      var buttonMColor = $('#buttonmenucolor');
      localforage.getItem('menucolor', function(e, val) {
        if (!val)
          return;
        buttonMColor.val(val);
      });

      var buttonBColor = $('#buttonbuttoncolor');
      localforage.getItem('buttoncolor', function(e, val) {
        if (!val)
          return;
        $('div.frame-new-button').css('background-color', val);
        buttonBColor.val(val);
      });

    	buttonMColor.change(function(e) {
        localforage.setItem('menucolor', this.value);
      });
      $('#buttonbuttoncolor').change(function(e) {
        localforage.setItem('buttoncolor', this.value);
        $('div.frame-new-button').css('background-color', this.value);
      });

      var fnSetZoom = function (val) {
        if (!game)
          return;
        game.zoom = val;
        game.resize(val);

        $("#gamezoom option:selected").removeAttr("selected");
        $('#gamezoom option[value="'+val+'"]').attr("selected", true);
      }
      var selectZoom = $('.cgamezoom');
      if(game) {
        localforage.getItem('gamezoom', function(e, val) {
          if (val)
            fnSetZoom(val);
        });
        fnSetZoom(1.0);
      }
    	selectZoom.change(function() {
    		var val = $('#gamezoom').val();
        localforage.setItem('gamezoom', val);
        fnSetZoom(val);
    	});

      var fnSetShortcut = function (val) {
        $('#shortcut_bar').removeClass();
        $('#shortcut_bar').addClass(val);

        $("#shortcutstyle option:selected").removeAttr("selected");
        $('#shortcutstyle option[value="'+val+'"]').attr("selected", true);
        ShortcutStyle=val;
      }
      var selectShortcut = $('#shortcutstyle');
      if(game) {
        localforage.getItem('shortcutstyle', function(e, val) {
            if (val)
              fnSetShortcut(val);
        });
        if (game.renderer.mobile || game.renderer.tablet) {
          if (window.innerWidth > window.innerHeight)
            fnSetShortcut("horizontal-desc");
          else {
            fnSetShortcut("vertical-desc");
          }
        }
        else
          fnSetShortcut("horizontal-asc");
      }
    	selectShortcut.change(function() {
    		var val = $('#shortcutstyle').val();
        localforage.setItem('shortcutstyle', val);
        fnSetShortcut(val);
    	});
    },

    apply: function () {
        var self = this;

        var buttonSound = $('#buttonsound');
        localforage.getItem('sound', function(e, val) {
          if (val === 0) {
            buttonSound.html("Off");
            buttonSound.removeClass('active');
            self.funcSound(false);
          }
          else {
            buttonSound.html("On");
            buttonSound.addClass('active');
            self.funcSound(true);
          }
        });


    },

    show: function() {
    	var self = this;
        this.toggle = !this.toggle;
    	if (this.toggle)
    	{
            $('#settings').css('display', 'block');
        }
        else
        {
            $('#settings').css('display', 'none');
        }
    }

  });
  return SettingsHandler;
});

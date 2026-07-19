// Converted from AMD (define) + Class.extend to a native ES6 module/class.
// NOTE: 'lib/virtualjoystick' is still loaded as a classic (non-module) script via a <script> tag
// and exposes `VirtualJoystick` as a global, so it is not imported here. `localforage` is now
// imported (for its window.localforage side effect) once from app.js, which the import graph
// guarantees runs before this file, so it's still safe to use here as a bare global.
/* global localforage, VirtualJoystick, log, ShortcutStyle */
export default class SettingsHandler {
    constructor(game) {
    	this.game = game;
    	this.app = game.app;
    	this.toggle = false;
    	const self = this;

    	$('#settingsclose').click(function(e){
                self.show();
    	});

      // FIX: removed dead commented-out #buttonsound click handler (superseded by the buttonSound binding below)
      this.funcSound = function (bSound)
      {
        if(self.game && self.game.audioManager) {
          self.game.audioManager.toggle(bSound);
        }
      };

      const buttonSound = $('#buttonsound');
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


      const funcChat = function (bChat)
      {
        if(self.game) {
          // FIX: branches were swapped (bChat=true called hideChatLog); every other toggle here (funcSound,
          // funcJoystick) treats b<Feature>=true as "show/enable", so this was backwards
    			if(bChat) {
    				app.showChatLog();
    			} else {
    				app.hideChatLog();
    			}
        }
      };

      const buttonChat = $('#buttonchat');
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


      const funcJoystick = function (bJoystick)
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

      const buttonJoystick = $('#buttonjoystick');
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

      const changeMColor = function (val) {
        $(':root').css('--pixel-bg', val);
      };

      const buttonMColor = $('#buttonmenucolor');
      localforage.getItem('menucolor', function(e, val) {
        if (!val)
          return;
        changeMColor(val);
        buttonMColor.val(val);
      });

    	buttonMColor.change(function(e) {
        localforage.setItem('menucolor', this.value);
        changeMColor(this.value);
      });

      const changeBColor = function (val) {
        $('div.frame-new-button').css('background-color', val);
      };

      const buttonBColor = $('#buttonbuttoncolor');
      localforage.getItem('buttoncolor', function(e, val) {
        if (!val)
          return;
        changeBColor(val);
        buttonBColor.val(val);
      });

      $('#buttonbuttoncolor').change(function(e) {
        localforage.setItem('buttoncolor', this.value);
        changeBColor(this.value);
      });

      const fnSetZoom = function (val) {
        if (!game)
          return;
        game.zoom = val;
        game.resize(val);

        $("#gamezoom option:selected").removeAttr("selected");
        $('#gamezoom option[value="'+val+'"]').attr("selected", true);
      }
      const selectZoom = $('.cgamezoom');
      if(game) {
        localforage.getItem('gamezoom', function(e, val) {
          if (val)
            fnSetZoom(val);
        });
        fnSetZoom(1.0);
      }
    	selectZoom.change(function() {
    		const val = $('#gamezoom').val();
        localforage.setItem('gamezoom', val);
        fnSetZoom(val);
    	});

      const fnSetShortcut = function (val) {
        $('#shortcut_bar').removeClass();
        $('#shortcut_bar').addClass(val);

        $("#shortcutstyle option:selected").removeAttr("selected");
        $('#shortcutstyle option[value="'+val+'"]').attr("selected", true);
        ShortcutStyle=val;
      }
      const selectShortcut = $('#shortcutstyle');
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
    		const val = $('#shortcutstyle').val();
        localforage.setItem('shortcutstyle', val);
        fnSetShortcut(val);
    	});
    }

    apply() {
        const self = this;

        const buttonSound = $('#buttonsound');
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


    }

    show() {
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
}

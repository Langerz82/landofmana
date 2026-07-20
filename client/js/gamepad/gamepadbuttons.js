// Extracted from gamepad.js: all PxGamepad button bindings (buttonOn/buttonOff for
// select/x/y/a/b/leftTop/rightTop/dpad*) plus their small page-switching helpers. Installed
// once from gamepad.js's constructor via installGamepadButtons(self).
import {
  getGamePadShortcut, setGamePadShortcut, jqAchievementWindow, jqAuctionSellWindow,
  jqBankWindow, jqConfirmWindow, jqDiedWindow, jqDropWindow, jqInventoryWindow,
  jqLeaderWindow, jqLooksPreview, jqLooksWindow, jqMenuWindow, jqNotifyWindow,
  jqPlayerPopupWindow, jqQuestWindow, jqSettingsWindow, jqShopWindow, jqSkillWindow,
  jqSocialWindow, jqStatWindow
} from './gamepad.js';
/* global DragItem, ShortcutData, game, log */

export function installGamepadButtons(self) {
  self.pxgamepad.buttonOn('select', function() {
    log.info("buttonOn = select");
    if (self.mainButtonsActive) {
      self.mainButtonsActive = false;
      self.setSelectedItem(null);
      return;
    }

    self.setSelectedItem($("#charactermenu"));
    self.mainButtonsActive = true;
    self.joystickX = 0;
    self.joystickY = 0;
  });

  self.pressShortcut = function (index) {
    self.setSelectedItem($(self.playerShortcut[index]));
    self.selectedItem.trigger("click");
  };

  self.pxgamepad.buttonOn('x', function() {
    if (self.leftTopPressed) {
      self.pressShortcut(2);
      return;
    }
    if (self.rightTopPressed) {
      return;
    }

    if (jqInventoryWindow.is(':visible')) {
      if (!DragItem)
        self.selectedItem.trigger('click');
      if (DragItem) {
        setGamePadShortcut({
            x: self.joystickX,
            y: self.joystickY,
            item: self.selectedItem
        });
        self.mainButtonsActive = true;
        self.joystickX = 1;
        self.joystickY = 1;
        return;
      }

      $('#allinventorywindow .inventoryGoldFrame').trigger('click');
      return;
    }

    if (jqSkillWindow.is(':visible')) {
      if (ShortcutData) {
        setGamePadShortcut({
            x: self.joystickX,
            y: self.joystickY,
            item: self.selectedItem
        });
        self.mainButtonsActive = true;
        self.joystickX = 1;
        self.joystickY = 1;
        return;
      }
    }

    if (jqBankWindow.is(':visible')) {
      $('#bankGoldFrame').trigger('click');
      return;
    }

    log.info("buttonOn = x");
    game.playerTargetClosestEntity(1);
	});

  self.pxgamepad.buttonOff('x', function() {
    log.info("buttonOff = x");
	});

  self.pxgamepad.buttonOn('y', function() {
    if (self.leftTopPressed) {
      self.pressShortcut(3);
      return;
    }
    if (self.rightTopPressed) {
      return;
    }

    if (jqInventoryWindow.is(':visible')) {
      $('#invActionButton').trigger('click');
    }
    if (jqBankWindow.is(':visible')) {
      $('#bankDialogStoreButton').trigger('click');
    }

    log.info("buttonOn = y");
    self.navMouse = !self.navMouse;
	});

  self.pxgamepad.buttonOff('y', function() {
    log.info("buttonOff = y");
	});

	self.pxgamepad.buttonOn('a', function() {
      log.info("buttonOn = a");
      if (self.leftTopPressed) {
        self.pressShortcut(0);
        return;
      }
      if (self.rightTopPressed) {
        self.pressShortcut(4);
        return;
      }

	    if(self.isDialogOpen())
	    {
        if (jqConfirmWindow.is(':visible'))
        {
          $("#dialogModalConfirmButton1").trigger("click");
          return;
        }
        if (jqNotifyWindow.is(':visible'))
        {
          $("#dialogModalNotifyButton1").trigger("click");
          return;
        }
        if (game.storeDialog.visible ||
            game.auctionDialog.visible ||
            game.appearanceDialog.visible && !jqLooksPreview.is(':visible') ||
            game.craftDialog.visible)
    		{
    		    if (self.selectedItem)
            {
                self.selectedItem.trigger("click");
            }
    		}
        if (jqAuctionSellWindow.is(':visible'))
        {
          $("#auctionSellAccept").trigger("click");
          return;
        }
    	  if (jqDiedWindow.is(':visible'))
    	  {
    	    $("#respawn").trigger('click');
          return;
    	  }
    	  if ($("#socialconfirm").is(':visible'))
    		{
    	    $('#socialconfirmyes').trigger("click");
    		}
      	else if (jqPlayerPopupWindow.is(':visible'))
    		{
    		    $(self.playerMode).trigger("click");
    		}
    		else if (jqDropWindow.is(':visible'))
    		{
    		    $("#dropAccept").trigger("click");
          return;
    		}
        if (jqLooksPreview.is(':visible'))
        {
          if (game.appearanceDialog.unlockLookMode)
            $("#changeLookUnlock").trigger("click");
          else
            $("#changeLookNext").trigger("click");
          return;
        }
        else if (jqSkillWindow.is(':visible'))
    		{
          if (game.selectedSkill) {
            $(self.playerShortcut.format(self.shortcutAssign)).trigger("click");
            self.mainButtonsActive = false;
            self.joystickX = 0;
            self.joystickY = 0;
          }
          else if (self.selectedItem) {
            self.selectedItem.trigger("click");
            if (ShortcutData == null) {
              self.mainButtonsActive = false;
              if (getGamePadShortcut()) {
                self.joystickX = getGamePadShortcut().x;
                self.joystickY = getGamePadShortcut().y;
                self.setSelectedItem(getGamePadShortcut().item);
                setGamePadShortcut(null);
              }
              else {
                self.joystickX = 0;
                self.joystickY = 0;
              }
            }
          }
          return;
    		}
        else if (jqStatWindow.is(':visible'))
    		{
          if (self.selectedItem) {
            self.selectedItem.trigger("click");
          }
    		}
        else if (jqBankWindow.is(':visible'))
      	{
          if (self.selectedItem)
            self.selectedItem.trigger("click");
          return;
        }
      	else if (jqInventoryWindow.is(':visible'))
      	{
          if (self.selectedItem) {
            self.selectedItem.trigger("click");
          }
          if (DragItem == null) {
            self.mainButtonsActive = false;
            if (getGamePadShortcut()) {
              self.joystickX = getGamePadShortcut().x;
              self.joystickY = getGamePadShortcut().y;
              self.setSelectedItem(getGamePadShortcut().item);
              setGamePadShortcut(null);
            }
            else {
              self.joystickX = 0;
              self.joystickY = 0;
            }
          }
          return;
        }
    		else if (jqMenuWindow.is(':visible'))
    		{
          if (self.selectedItem)
            self.selectedItem.trigger("click");
    		}
        else if (jqSettingsWindow.is(':visible'))
        {
          if (self.selectedItem)
          {
              self.selectedItem.trigger("click");
          }
        }
        else if (self.mainButtonsActive)
        {
          log.info("self.mainButtonsActive");
          if (self.selectedItem)
          {
              self.selectedItem.trigger("click");

              /*if (self.selectedItem.attr('id') === 'charactermenu')
              {
                self.setSelectedItem($("#inventorybutton"));
              }*/
              /*if (self.selectedItem[0].id === 'shortcutbutton')
              {
                self.shortcutActive = true;
              }*/
              self.dialogOpen($('#charactermenu'));
          }
          self.mainButtonsActive = false;
        }
        self.joystickX = 0;
        self.joystickY = 0;
     }
     else
     {
        if (self.navMouse)
          game.click();
        else
          game.makePlayerInteractNextTo();
     }
	});

	self.pxgamepad.buttonOn('b', function() {
    log.info("buttonOn = b");
    if (self.leftTopPressed) {
      self.pressShortcut(1);
      return;
    }
    if (self.rightTopPressed) {
      self.pressShortcut(5);
      return;
    }

    if(self.isDialogOpen())
    {
        if (jqConfirmWindow.is(':visible'))
        {
          $("#dialogModalConfirmButton2").trigger("click");
          return;
        }
        if (jqNotifyWindow.is(':visible'))
        {
          $("#dialogModalNotifyButton1").trigger("click");
          return;
        }
        if (jqDiedWindow.is(':visible'))
    	  {
    	    $("#respawn").trigger('click');
          return;
    	  }
        if (jqAuctionSellWindow.is(':visible'))
        {
          $("#auctionSellCancel").trigger("click");
          return;
        }
	    	if ($("#socialconfirm").is(':visible'))
    		{
      	    $('#socialconfirmno').trigger("click");
    		    $('#socialconfirm').css('display', 'none');
    		}
    		else if (jqPlayerPopupWindow.is(':visible'))
    		{
    		    game.playerPopupMenu.close();
    		}
	    	else if ($("#chatbox").is(':visible'))
	    	{
	    	    $("#chatbox").hide();
	    	}
        else if (jqSkillWindow.is(':visible'))
        {
          $("#skillsCloseButton").trigger("click");
        }
        else if (jqStatWindow.is(':visible'))
        {
          $("#statsCloseButton").trigger("click");
        }
	    	else if (jqInventoryWindow.is(':visible'))
	    	{
            const inv = game.inventoryHandler;
            if (inv.selectedItem >= 0) {
              inv.deselectItem();
              return;
            } else {
	    	      $("#inventoryCloseButton").trigger("click");
            }
	    	}
	    	else if (jqQuestWindow.is(':visible'))
	    	{
	    	    $("#questCloseButton").trigger("click");
	    	}
        else if (jqAchievementWindow.is(':visible'))
        {
            $("#achievementCloseButton").trigger("click");
        }
	    	else if (jqSocialWindow.is(':visible'))
	    	{
	    	    $("#socialclose").trigger("click");
	    	}
	    	else if (jqSettingsWindow.is(':visible'))
	    	{
	    	    $("#settingsclose").trigger("click");
	    	}
	    	else if (jqLeaderWindow.is(':visible'))
	    	{
	    	    $("#leaderboardclose").trigger("click");
	    	}
        else if (jqShopWindow.is(':visible'))
	    	{
	    	    $("#shopCloseButton").trigger("click");
	    	}
    		else if (jqMenuWindow.is(':visible'))
    		{
    		    jqMenuWindow.trigger("click");
          self.mainButtonsActive = false;
    		}
    		else if (jqDropWindow.is(':visible'))
    		{
    		    $("#dropCancel").trigger("click");
          return;
    		}
    		else if (game.storeDialog.visible ||
          game.auctionDialog.visible ||
          game.appearanceDialog.visible)
    		{
          $("#storeDialogCloseButton").trigger("click");
    		}
        else if (game.craftDialog.visible)
    		{
    		    $("#craftDialogCloseButton").trigger("click");
    		}
    		else if (jqBankWindow.is(':visible'))
    		{
          if (game.bankDialog.bankFrame.selectedItem >= 0)
            game.bankDialog.bankFrame.deselectItem();
          else
    		      $("#bankDialogCloseButton").trigger("click");
    		}
        else if (jqLooksWindow.is(':visible'))
        {
          $("#appearanceCloseButton").trigger("click");
        }
        else if (jqLooksPreview.is(':visible'))
        {
          $("#appearanceCloseButton").trigger("click");
        }
        else if (self.mainButtonsActive)
        {
          self.mainButtonsActive = false;
          self.setSelectedItem(null);
        }
        if (!self.isDialogOpen())
        {
      		self.joystickIndex = 0;
          self.setSelectedItem(null);
          self.joystickX = -1;
          self.joystickY = -1;
        }
	    }
	    else
	    {
	    }
	});

    	self.pxgamepad.buttonOff('b', function() {
        log.info("buttonOff = b");

        /*if ($("#attackContainer").is(':visible') && self.selectedItem && self.shortcutActive)
            self.selectedItem.trigger("click");
        self.shortcutActive = false;*/



      });

      /*var switchInventoryDialogPage = function (mod) {
        var l = self.playerInventoryButtons.length;
        var i = (l+self.invPageIndex+mod) % l;
        self.invPageIndex = i;
        var jq = $(self.playerInventoryButtons[i]);

        self.setSelectedItem(jq);
      }*/

      /*var switchBankDialogPage = function (mod) {
        var l = self.bankPages.length;
        var i = (l+self.bankPageIndex+mod) % l;
        self.bankPageIndex = i;
        var jq = $(self.bankPages[i]);

        self.setSelectedItem(jq);
      }*/

      const switchShopDialogPage = function (mod) {
        let sides = self.storeDialogSide;
        if (game.appearanceDialog.visible)
          sides = self.looksDialogSide;

        const l = sides.length;
        const i = (l+self.shopPageIndex+mod) % l;
        self.shopPageIndex = i;
        const jq = $(sides[i]);

        self.setSelectedItem(jq);
      }

      const switchLooksDialogPage = function (mod) {
        const l = self.looksDialogSide.length;
        const i = (l+self.shopPageIndex+mod) % l;
        self.shopPageIndex = i;
        const jq = $(self.looksDialogSide[i]);

        self.setSelectedItem(jq);
      }

      const switchCraftDialogPage = function (mod) {
        const l = 3;
        const i = (l+self.craftPageIndex+mod) % l;
        self.craftPageIndex = i;
        const jq = $(self.craftDialogButtons.format(i));

        self.setSelectedItem(jq);
      }

      self.pxgamepad.buttonOn('leftTop', function() {
        if (jqInventoryWindow.is(':visible'))
        {
          return;
        }
        if (jqBankWindow.is(':visible')) {
          return;
        }
        if (game.appearanceDialog.visible) {
          switchLooksDialogPage(-1);
          return;
        }
        if ($("#storeDialogStore").is(':visible')) {
          switchShopDialogPage(-1);
          return;
        }
        if ($("#craftDialog").is(':visible')) {
          switchCraftDialogPage(-1);
          return;
        }

        self.leftTopPressed = true;
      });
      self.pxgamepad.buttonOff('leftTop', function() {
        self.leftTopPressed = false;
      });

      self.pxgamepad.buttonOn('rightTop', function() {
        if (jqInventoryWindow.is(':visible'))
        {
          return;
        }
        if (jqBankWindow.is(':visible')) {
          return;
        }
        if (game.appearanceDialog.visible) {
          switchLooksDialogPage(1);
          return;
        }
        if ($("#storeDialogStore").is(':visible')) {
          switchShopDialogPage(1);
          return;
        }
        if ($("#craftDialog").is(':visible')) {
          switchCraftDialogPage(1);
          return;
        }

        self.rightTopPressed = true;
      });

      self.pxgamepad.buttonOff('rightTop', function() {
        self.rightTopPressed = false;
      });



      // Default.

	    self.joystickSide = 0;
	    self.joystickIndex = 0;

      self.pxgamepad.buttonOn('dpadUp', function() {
        self.dpadY = -1;
        self.dpadX = 0;
    	});

      self.pxgamepad.buttonOn('dpadDown', function() {
        self.dpadY = 1;
        self.dpadX = 0;
    	});

      self.pxgamepad.buttonOn('dpadLeft', function() {
        self.dpadX = -1;
        self.dpadY = 0;
    	});

      self.pxgamepad.buttonOn('dpadRight', function() {
        self.dpadX = 1;
        self.dpadY = 0;
    	});

      self.pxgamepad.buttonOff('dpadUp', function() {
        self.dpadX = 0;
        self.dpadY = 0;
    	});

      self.pxgamepad.buttonOff('dpadDown', function() {
        self.dpadX = 0;
        self.dpadY = 0;
    	});

      self.pxgamepad.buttonOff('dpadLeft', function() {
        self.dpadX = 0;
        self.dpadY = 0;
    	});

      self.pxgamepad.buttonOff('dpadRight', function() {
        self.dpadX = 0;
        self.dpadY = 0;
    	});
}

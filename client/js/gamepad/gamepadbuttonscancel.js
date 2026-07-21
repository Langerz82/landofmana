// Extracted from gamepad.js/gamepadbuttons.js: the 'b' (cancel/back) button binding.
// Installed once from gamepad.js's constructor via install*(self).
import {
  jqAchievementWindow, jqAuctionSellWindow, jqBankWindow, jqConfirmWindow, jqDiedWindow, jqDropWindow, jqInventoryWindow, jqLeaderWindow, jqLooksPreview, jqLooksWindow, jqMenuWindow, jqNotifyWindow, jqPlayerPopupWindow, jqQuestWindow, jqSettingsWindow, jqShopWindow, jqSkillWindow, jqSocialWindow, jqStatWindow
} from './gamepad.js';
/* global game, log */

export function installGamepadButtonsCancel(self) {
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
}

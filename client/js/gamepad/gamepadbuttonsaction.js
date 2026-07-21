// Extracted from gamepad.js/gamepadbuttons.js: the 'a' (accept/confirm) button binding.
// Installed once from gamepad.js's constructor via install*(self).
import {
  getGamePadShortcut, setGamePadShortcut, jqAuctionSellWindow, jqBankWindow, jqConfirmWindow, jqDiedWindow, jqDropWindow, jqInventoryWindow, jqLooksPreview, jqMenuWindow, jqNotifyWindow, jqPlayerPopupWindow, jqSettingsWindow, jqSkillWindow, jqStatWindow
} from './gamepad.js';
/* global DragItem, ShortcutData, game, log */

export function installGamepadButtonsAction(self) {
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
}

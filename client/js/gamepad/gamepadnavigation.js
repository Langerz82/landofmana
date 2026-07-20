// Extracted from gamepad.js: the per-UI-context navigation dispatch (funcNavigation's
// if/else-if chain). Each branch checks which dialog/window is currently visible and moves
// the on-screen selection accordingly. Called from gamepad.js's funcNavigation() wrapper.
import {
  Navigate, jqBankWindow, jqInventoryWindow, jqLeaderWindow, jqLooksPreview,
  jqMenuWindow, jqSettingsWindow, jqSkillWindow, jqStatWindow
} from './gamepad.js';
/* global Utils, ShortcutData, ShortcutStyle, game */

export function runGamepadNavigation(self, navigate) {
    if (game.storeDialog.visible ||
         game.auctionDialog.visible ||
         game.appearanceDialog.visible && !jqLooksPreview.is(':visible') ||
         game.craftDialog.visible)
    {
       if (navigate === Navigate.UP)
       {
         self.joystickY = Utils.clamp(0,5, (self.joystickY-1));
         if (self.joystickY === 0)
         {
           const index = self.storeDialogSide[self.joystickX];
           self.setSelectedItem($(index));
           if (self.joystickX === 3)
           {
             self.joystickX = 0;
             self.joystickY = 0;
           }
           $(index).trigger("click");
         }
         else {
           const index = self.storeDialogBuyButton.format(self.joystickY-1);
           self.setSelectedItem($(index));
         }
       }
       if (navigate === Navigate.DOWN)
       {
         self.joystickY = Utils.clamp(0,5,(self.joystickY+1));
         if (self.joystickY >= 1) {
           const index = self.storeDialogBuyButton.format(self.joystickY-1);
           self.setSelectedItem($(index));
         }
       }
       if (navigate === Navigate.LEFT)
       {
         if (self.joystickY === 0) {
           self.joystickX = Utils.clamp(0,3,(self.joystickX-1));
           const index = self.storeDialogSide[self.joystickX];
           self.setSelectedItem($(index));
           $(index).trigger("click");
         }
         else {
           $('#storePageNavPrev').trigger("click");
         }
       }
       if (navigate === Navigate.RIGHT)
       {
         if (self.joystickY === 0) {
           self.joystickX = Utils.clamp(0,3,(self.joystickX+1));
           const index = self.storeDialogSide[self.joystickX];
           if (self.joystickX === 3)
           {
             self.joystickX = 0;
             self.joystickY = 0;
           }
           self.setSelectedItem($(index));
           $(index).trigger("click");
         }
         else {
           $('#storePageNavNext').trigger("click");
         }
       }
    }
    else if (jqLooksPreview.is(':visible')) {
      if (!game.appearanceDialog.unlockLookMode) {
        if (navigate === Navigate.LEFT)
        {
          $("#changeLookPrev").trigger("click");
        }
        if (navigate === Navigate.RIGHT)
        {
          $("#changeLookNext").trigger("click");
        }
      }
      return;
    }
    else if (jqBankWindow.is(':visible'))
    {
      let modx = 0, mody = 0;
      if (navigate === Navigate.UP)
      {
        mody = -1;
      }
      if (navigate === Navigate.DOWN)
      {
        mody = 1;
      }
      if (navigate === Navigate.LEFT)
      {
        modx = -1;
      }
      if (navigate === Navigate.RIGHT)
      {
        modx = 1;
      }

      if (navigate !== 0) {
        self.joystickX = ((self.joystickX+6+modx)%6);
        self.joystickY = ((self.joystickY+16+mody)%16);
        const index =(self.joystickY)*6+(self.joystickX);
        const jqi = self.playerBank.format(index);
        $(jqi).get(0).scrollIntoView();
        self.setSelectedItem($(jqi));
      }
    }
    else if (jqMenuWindow.is(':visible'))
    {
      const len = self.menuButtons.length;
      //{
        let mody = 0;
        if (navigate === Navigate.UP)
        {
          mody=-1;
        }
        if (navigate === Navigate.DOWN)
        {
          mody=1;
        }

      if (navigate !== 0) {
        self.joystickY = (self.joystickY+mody+len)%len;
        const index = self.menuButtons[self.joystickY];
        self.setSelectedItem($(index));
      }
    }
    else if (self.mainButtonsActive)
    {
      if (navigate === 0)
        return;

      const buttons = {};
      let modx = 0, mody = 0;

      buttons['0-0'] = self.mainButtons[0];
      buttons['1-0'] = self.mainButtons[1];

      if (ShortcutStyle.indexOf('horizontal') === 0)
      {
        buttons['1-1'] = self.playerShortcut[0];
        buttons['1-2'] = self.playerShortcut[1];
        buttons['1-3'] = self.playerShortcut[2];
        buttons['1-4'] = self.playerShortcut[3];
        buttons['1-5'] = self.playerShortcut[4];
        buttons['1-6'] = self.playerShortcut[5];
        buttons['1-7'] = self.playerShortcut[6];

        if (ShortcutStyle === "horizontal-asc") {
          if (navigate === Navigate.LEFT)
            modx = -1;
          if (navigate === Navigate.RIGHT)
            modx = 1;
        }
        else if (ShortcutStyle === "horizontal-desc") {
          if (navigate === Navigate.LEFT)
            modx = 1;
          if (navigate === Navigate.RIGHT)
            modx = -1;
        }

        if (navigate === Navigate.UP || navigate === Navigate.DOWN) {
          mody = 1;
        }
        self.joystickX = (self.joystickX+modx+8)%8;
        self.joystickY = (self.joystickY+mody+2)%2;
      }
      if (ShortcutStyle.indexOf('vertical') === 0)
      {
        buttons['1-1'] = self.playerShortcut[0];
        buttons['2-1'] = self.playerShortcut[1];
        buttons['3-1'] = self.playerShortcut[2];
        buttons['4-1'] = self.playerShortcut[3];
        buttons['5-1'] = self.playerShortcut[4];
        buttons['6-1'] = self.playerShortcut[5];
        buttons['7-1'] = self.playerShortcut[6];

        if (ShortcutStyle === "vertical-asc") {
          if (navigate === Navigate.UP)
            mody = -1;
          if (navigate === Navigate.DOWN)
            mody = 1;
        }
        else if (ShortcutStyle === "vertical-desc") {
          if (navigate === Navigate.UP)
            mody = 1;
          if (navigate === Navigate.DOWN)
            mody = -1;
        }
        if (navigate === Navigate.LEFT || navigate === Navigate.RIGHT) {
          modx = 1;
        }
        self.joystickX = (self.joystickX+modx+2)%2;
        self.joystickY = (self.joystickY+mody+8)%8;
      }

      if (self.joystickY === 0) {
        self.setSelectedItem($(buttons['0-0']));
      }
      else if (self.joystickX === 0) {
        self.setSelectedItem($(buttons['1-0']));
      }
      else {
        self.setSelectedItem($(buttons[self.joystickY+'-'+self.joystickX]));
      }
      return;
    }
    else if (jqInventoryWindow.is(':visible'))
    {
      let equipment = false;
      let modx = 0, mody = 0;
      if (navigate === Navigate.UP)
      {
        mody = -1;
      }
      if (navigate === Navigate.DOWN)
      {
        mody = 1;
      }
      if (navigate === Navigate.LEFT)
      {
        modx = -1;
      }
      if (navigate === Navigate.RIGHT)
      {
        modx = 1;
      }

      if (navigate !== 0) {
        self.joystickX = ((self.joystickX+5+modx)%5);
        self.joystickY = ((self.joystickY+11+mody)%11);
  			if (self.joystickY === 0)
  			{
  				equipment = true;
  			}

        let index = self.playerInventory.format((self.joystickY-1)*5+(self.joystickX));
        if (equipment) {
          index = self.playerEquipment[self.joystickX];
        }
        $(index).get(0).scrollIntoView();
        self.setSelectedItem($(index));
      }
      return;
    }
    else if (jqSkillWindow.is(':visible'))
    {
      let modx = 0;
      let mody = 0;
      if (navigate === Navigate.UP)
      {
        mody = -1;
      }
      if (navigate === Navigate.DOWN)
      {
        mody = 1;
      }
      if (navigate === Navigate.LEFT)
      {
        modx = -1;
      }
      if (navigate === Navigate.RIGHT)
      {
        modx = 1;
      }
      if (navigate !== 0 || !ShortcutData) {
        self.joystickX = (self.joystickX+(4 + modx)) % 4;
        self.joystickY = (self.joystickY+(2 + mody)) % 2;
        const index = self.playerDialogSkill.format((self.joystickY)*4+(self.joystickX));
        self.setSelectedItem($(index));
        $(index).trigger("click");
      }
    }
    else if (jqStatWindow.is(':visible'))
    {
      if (navigate === Navigate.UP)
      {
        self.joystickY = Utils.clamp(0,4,(self.joystickY-1));
        const index = self.playerDialogStat[self.joystickY];
        self.setSelectedItem($(index));
      }
      if (navigate === Navigate.DOWN)
      {
        self.joystickY = Utils.clamp(0,4,(self.joystickY+1));
        const index = self.playerDialogStat[self.joystickY];
        self.setSelectedItem($(index));
      }
    }
    else if (jqSettingsWindow.is(':visible'))
    {
      if (navigate === Navigate.UP)
      {
        self.joystickY = Utils.clamp(0,5,(self.joystickY-1));
        const index = self.playerSettings[self.joystickY];
        self.setSelectedItem($(index));
      }
      if (navigate === Navigate.DOWN)
      {
        self.joystickY = Utils.clamp(0,5,(self.joystickY+1));
        const index = self.playerSettings[self.joystickY];
        self.setSelectedItem($(index));
      }
    }
    else if (jqLeaderWindow.is(':visible'))
    {
      if (navigate === Navigate.LEFT)
      {
        const index = self.leaderboardselect[0];
        self.setSelectedItem($(index));
      }
      if (navigate === Navigate.RIGHT)
      {
        const index = self.leaderboardselect[1];
        self.setSelectedItem($(index));
      }
    }
}

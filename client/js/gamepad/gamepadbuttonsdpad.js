// Extracted from gamepad.js/gamepadbuttons.js: shoulder buttons (leftTop/rightTop, plus
// their shop/looks/craft dialog page-switch helpers) and the dpad direction bindings.
// Installed once from gamepad.js's constructor via install*(self).
import {
  jqBankWindow, jqInventoryWindow
} from './gamepad.js';
/* global game */

export function installGamepadButtonsDpad(self) {
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

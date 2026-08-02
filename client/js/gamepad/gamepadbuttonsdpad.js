// Extracted from gamepad.js/gamepadbuttons.js: shoulder buttons (leftTop/rightTop, plus
// their shop/looks/craft dialog page-switch helpers) and the dpad direction bindings.
// Installed once from gamepad.js's constructor via install*(self).
/* global game */

export function installGamepadButtonsDpad(self) {
    // Selector lookups checked repeatedly in the shoulder-button handlers below - cached once
    // here (installGamepadButtonsDpad runs once, from Gamepad's constructor) as properties on
    // `self` (the Gamepad instance) instead of re-querying the DOM on every button press.
    // jqBankWindow/jqInventoryWindow are already set on `self` by Gamepad's constructor
    // (gamepad.js) before this function runs.
    self.jqStoreDialogStore = $('#storeDialogStore');
    self.jqCraftDialog = $('#craftDialog');

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
        if (game.appearanceDialog.visible) sides = self.looksDialogSide;

        const l = sides.length;
        const i = (l + self.shopPageIndex + mod) % l;
        self.shopPageIndex = i;
        const jq = $(sides[i]);

        self.setSelectedItem(jq);
    };

    const switchLooksDialogPage = function (mod) {
        const l = self.looksDialogSide.length;
        const i = (l + self.shopPageIndex + mod) % l;
        self.shopPageIndex = i;
        const jq = $(self.looksDialogSide[i]);

        self.setSelectedItem(jq);
    };

    const switchCraftDialogPage = function (mod) {
        const l = 3;
        const i = (l + self.craftPageIndex + mod) % l;
        self.craftPageIndex = i;
        const jq = $(self.craftDialogButtons.format(i));

        self.setSelectedItem(jq);
    };

    self.pxgamepad.buttonOn('leftTop', function () {
        if (self.jqInventoryWindow.is(':visible')) {
            return;
        }
        if (self.jqBankWindow.is(':visible')) {
            return;
        }
        if (game.appearanceDialog.visible) {
            switchLooksDialogPage(-1);
            return;
        }
        if (self.jqStoreDialogStore.is(':visible')) {
            switchShopDialogPage(-1);
            return;
        }
        if (self.jqCraftDialog.is(':visible')) {
            switchCraftDialogPage(-1);
            return;
        }

        self.leftTopPressed = true;
    });
    self.pxgamepad.buttonOff('leftTop', function () {
        self.leftTopPressed = false;
    });

    self.pxgamepad.buttonOn('rightTop', function () {
        if (self.jqInventoryWindow.is(':visible')) {
            return;
        }
        if (self.jqBankWindow.is(':visible')) {
            return;
        }
        if (game.appearanceDialog.visible) {
            switchLooksDialogPage(1);
            return;
        }
        if (self.jqStoreDialogStore.is(':visible')) {
            switchShopDialogPage(1);
            return;
        }
        if (self.jqCraftDialog.is(':visible')) {
            switchCraftDialogPage(1);
            return;
        }

        self.rightTopPressed = true;
    });

    self.pxgamepad.buttonOff('rightTop', function () {
        self.rightTopPressed = false;
    });

    // Default.

    self.joystickSide = 0;
    self.joystickIndex = 0;

    self.pxgamepad.buttonOn('dpadUp', function () {
        self.dpadY = -1;
        self.dpadX = 0;
    });

    self.pxgamepad.buttonOn('dpadDown', function () {
        self.dpadY = 1;
        self.dpadX = 0;
    });

    self.pxgamepad.buttonOn('dpadLeft', function () {
        self.dpadX = -1;
        self.dpadY = 0;
    });

    self.pxgamepad.buttonOn('dpadRight', function () {
        self.dpadX = 1;
        self.dpadY = 0;
    });

    self.pxgamepad.buttonOff('dpadUp', function () {
        self.dpadX = 0;
        self.dpadY = 0;
    });

    self.pxgamepad.buttonOff('dpadDown', function () {
        self.dpadX = 0;
        self.dpadY = 0;
    });

    self.pxgamepad.buttonOff('dpadLeft', function () {
        self.dpadX = 0;
        self.dpadY = 0;
    });

    self.pxgamepad.buttonOff('dpadRight', function () {
        self.dpadX = 0;
        self.dpadY = 0;
    });
}

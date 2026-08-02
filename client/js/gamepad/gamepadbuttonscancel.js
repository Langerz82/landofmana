// Extracted from gamepad.js/gamepadbuttons.js: the 'b' (cancel/back) button binding.
// Installed once from gamepad.js's constructor via install*(self).
/* global game, log */

export function installGamepadButtonsCancel(self) {
    // Selector lookups used repeatedly inside the 'b' button handler below - cached once here
    // (installGamepadButtonsCancel runs once, from Gamepad's constructor) as properties on
    // `self` (the Gamepad instance) instead of re-querying the DOM on every button press.
    // jqAchievementWindow/jqAuctionSellWindow/jqBankWindow/jqConfirmWindow/jqDiedWindow/
    // jqDropWindow/jqInventoryWindow/jqLeaderWindow/jqLooksPreview/jqLooksWindow/jqMenuWindow/
    // jqNotifyWindow/jqPlayerPopupWindow/jqQuestWindow/jqSettingsWindow/jqShopWindow/
    // jqSkillWindow/jqSocialWindow/jqStatWindow are already set on `self` by Gamepad's
    // constructor (gamepad.js) before this function runs.
    self.jqDialogModalConfirmButton2 = $('#dialogModalConfirmButton2');
    self.jqDialogModalNotifyButton1 = $('#dialogModalNotifyButton1');
    self.jqRespawn = $('#respawn');
    self.jqAuctionSellCancel = $('#auctionSellCancel');
    self.jqSocialConfirm = $('#socialconfirm');
    self.jqSocialConfirmNo = $('#socialconfirmno');
    self.jqChatbox = $('#chatbox');
    self.jqSkillsCloseButton = $('#skillsCloseButton');
    self.jqStatsCloseButton = $('#statsCloseButton');
    self.jqInventoryCloseButton = $('#inventoryCloseButton');
    self.jqQuestCloseButton = $('#questCloseButton');
    self.jqAchievementCloseButton = $('#achievementCloseButton');
    self.jqSocialClose = $('#socialclose');
    self.jqSettingsClose = $('#settingsclose');
    self.jqLeaderboardClose = $('#leaderboardclose');
    self.jqShopCloseButton = $('#shopCloseButton');
    self.jqDropCancel = $('#dropCancel');
    self.jqStoreDialogCloseButton = $('#storeDialogCloseButton');
    self.jqCraftDialogCloseButton = $('#craftDialogCloseButton');
    self.jqBankDialogCloseButton = $('#bankDialogCloseButton');
    self.jqAppearanceCloseButton = $('#appearanceCloseButton');

    self.pxgamepad.buttonOn('b', function () {
        log.info('buttonOn = b');
        if (self.leftTopPressed) {
            self.pressShortcut(1);
            return;
        }
        if (self.rightTopPressed) {
            self.pressShortcut(5);
            return;
        }

        if (self.isDialogOpen()) {
            if (self.jqConfirmWindow.is(':visible')) {
                self.jqDialogModalConfirmButton2.trigger('click');
                return;
            }
            if (self.jqNotifyWindow.is(':visible')) {
                self.jqDialogModalNotifyButton1.trigger('click');
                return;
            }
            if (self.jqDiedWindow.is(':visible')) {
                self.jqRespawn.trigger('click');
                return;
            }
            if (self.jqAuctionSellWindow.is(':visible')) {
                self.jqAuctionSellCancel.trigger('click');
                return;
            }
            if (self.jqSocialConfirm.is(':visible')) {
                self.jqSocialConfirmNo.trigger('click');
                self.jqSocialConfirm.css('display', 'none');
            } else if (self.jqPlayerPopupWindow.is(':visible')) {
                game.playerPopupMenu.close();
            } else if (self.jqChatbox.is(':visible')) {
                self.jqChatbox.hide();
            } else if (self.jqSkillWindow.is(':visible')) {
                self.jqSkillsCloseButton.trigger('click');
            } else if (self.jqStatWindow.is(':visible')) {
                self.jqStatsCloseButton.trigger('click');
            } else if (self.jqInventoryWindow.is(':visible')) {
                const inv = game.inventoryHandler;
                if (inv.selectedItem >= 0) {
                    inv.deselectItem();
                    return;
                } else {
                    self.jqInventoryCloseButton.trigger('click');
                }
            } else if (self.jqQuestWindow.is(':visible')) {
                self.jqQuestCloseButton.trigger('click');
            } else if (self.jqAchievementWindow.is(':visible')) {
                self.jqAchievementCloseButton.trigger('click');
            } else if (self.jqSocialWindow.is(':visible')) {
                self.jqSocialClose.trigger('click');
            } else if (self.jqSettingsWindow.is(':visible')) {
                self.jqSettingsClose.trigger('click');
            } else if (self.jqLeaderWindow.is(':visible')) {
                self.jqLeaderboardClose.trigger('click');
            } else if (self.jqShopWindow.is(':visible')) {
                self.jqShopCloseButton.trigger('click');
            } else if (self.jqMenuWindow.is(':visible')) {
                self.jqMenuWindow.trigger('click');
                self.mainButtonsActive = false;
            } else if (self.jqDropWindow.is(':visible')) {
                self.jqDropCancel.trigger('click');
                return;
            } else if (
                game.storeDialog.visible ||
                game.auctionDialog.visible ||
                game.appearanceDialog.visible
            ) {
                self.jqStoreDialogCloseButton.trigger('click');
            } else if (game.craftDialog.visible) {
                self.jqCraftDialogCloseButton.trigger('click');
            } else if (self.jqBankWindow.is(':visible')) {
                if (game.bankDialog.bankFrame.selectedItem >= 0)
                    game.bankDialog.bankFrame.deselectItem();
                else self.jqBankDialogCloseButton.trigger('click');
            } else if (self.jqLooksWindow.is(':visible')) {
                self.jqAppearanceCloseButton.trigger('click');
            } else if (self.jqLooksPreview.is(':visible')) {
                self.jqAppearanceCloseButton.trigger('click');
            } else if (self.mainButtonsActive) {
                self.mainButtonsActive = false;
                self.setSelectedItem(null);
            }
            if (!self.isDialogOpen()) {
                self.joystickIndex = 0;
                self.setSelectedItem(null);
                self.joystickX = -1;
                self.joystickY = -1;
            }
        } else {
        }
    });

    self.pxgamepad.buttonOff('b', function () {
        log.info('buttonOff = b');

        /*if ($("#attackContainer").is(':visible') && self.selectedItem && self.shortcutActive)
            self.selectedItem.trigger("click");
        self.shortcutActive = false;*/
    });
}

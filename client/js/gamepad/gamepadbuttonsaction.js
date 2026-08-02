// Extracted from gamepad.js/gamepadbuttons.js: the 'a' (accept/confirm) button binding.
// Installed once from gamepad.js's constructor via install*(self).
import { getGamePadShortcut, setGamePadShortcut } from './gamepad.js';
/* global DragItem, ShortcutData, game, log */

export function installGamepadButtonsAction(self) {
    // Selector lookups used repeatedly inside the 'a' button handler below - cached once here
    // (installGamepadButtonsAction runs once, from Gamepad's constructor) as properties on
    // `self` (the Gamepad instance) instead of re-querying the DOM on every button press.
    // jqAuctionSellWindow/jqBankWindow/jqConfirmWindow/jqDiedWindow/jqDropWindow/
    // jqInventoryWindow/jqLooksPreview/jqMenuWindow/jqNotifyWindow/jqPlayerPopupWindow/
    // jqSettingsWindow/jqSkillWindow/jqStatWindow are already set on `self` by Gamepad's
    // constructor (gamepad.js) before this function runs.
    self.jqDialogModalConfirmButton1 = $('#dialogModalConfirmButton1');
    self.jqDialogModalNotifyButton1 = $('#dialogModalNotifyButton1');
    self.jqAuctionSellAccept = $('#auctionSellAccept');
    self.jqRespawn = $('#respawn');
    self.jqSocialConfirm = $('#socialconfirm');
    self.jqSocialConfirmYes = $('#socialconfirmyes');
    self.jqDropAccept = $('#dropAccept');
    self.jqChangeLookUnlock = $('#changeLookUnlock');
    // self.jqChangeLookNext/self.jqCharacterMenu already set on `self` by Gamepad's
    // constructor (gamepad.js).

    self.pxgamepad.buttonOn('a', function () {
        log.info('buttonOn = a');
        if (self.leftTopPressed) {
            self.pressShortcut(0);
            return;
        }
        if (self.rightTopPressed) {
            self.pressShortcut(4);
            return;
        }

        if (self.isDialogOpen()) {
            if (self.jqConfirmWindow.is(':visible')) {
                self.jqDialogModalConfirmButton1.trigger('click');
                return;
            }
            if (self.jqNotifyWindow.is(':visible')) {
                self.jqDialogModalNotifyButton1.trigger('click');
                return;
            }
            if (
                game.storeDialog.visible ||
                game.auctionDialog.visible ||
                (game.appearanceDialog.visible &&
                    !self.jqLooksPreview.is(':visible')) ||
                game.craftDialog.visible
            ) {
                if (self.selectedItem) {
                    self.selectedItem.trigger('click');
                }
            }
            if (self.jqAuctionSellWindow.is(':visible')) {
                self.jqAuctionSellAccept.trigger('click');
                return;
            }
            if (self.jqDiedWindow.is(':visible')) {
                self.jqRespawn.trigger('click');
                return;
            }
            if (self.jqSocialConfirm.is(':visible')) {
                self.jqSocialConfirmYes.trigger('click');
            } else if (self.jqPlayerPopupWindow.is(':visible')) {
                // NOTE: self.playerMode is a runtime-computed selector (not cached - varies
                // by state, no single fixed value to cache).
                $(self.playerMode).trigger('click');
            } else if (self.jqDropWindow.is(':visible')) {
                self.jqDropAccept.trigger('click');
                return;
            }
            if (self.jqLooksPreview.is(':visible')) {
                if (game.appearanceDialog.unlockLookMode)
                    self.jqChangeLookUnlock.trigger('click');
                else self.jqChangeLookNext.trigger('click');
                return;
            } else if (self.jqSkillWindow.is(':visible')) {
                if (game.selectedSkill) {
                    $(self.playerShortcut.format(self.shortcutAssign)).trigger(
                        'click'
                    );
                    self.mainButtonsActive = false;
                    self.joystickX = 0;
                    self.joystickY = 0;
                } else if (self.selectedItem) {
                    self.selectedItem.trigger('click');
                    if (ShortcutData == null) {
                        self.mainButtonsActive = false;
                        if (getGamePadShortcut()) {
                            self.joystickX = getGamePadShortcut().x;
                            self.joystickY = getGamePadShortcut().y;
                            self.setSelectedItem(getGamePadShortcut().item);
                            setGamePadShortcut(null);
                        } else {
                            self.joystickX = 0;
                            self.joystickY = 0;
                        }
                    }
                }
                return;
            } else if (self.jqStatWindow.is(':visible')) {
                if (self.selectedItem) {
                    self.selectedItem.trigger('click');
                }
            } else if (self.jqBankWindow.is(':visible')) {
                if (self.selectedItem) self.selectedItem.trigger('click');
                return;
            } else if (self.jqInventoryWindow.is(':visible')) {
                if (self.selectedItem) {
                    self.selectedItem.trigger('click');
                }
                if (DragItem == null) {
                    self.mainButtonsActive = false;
                    if (getGamePadShortcut()) {
                        self.joystickX = getGamePadShortcut().x;
                        self.joystickY = getGamePadShortcut().y;
                        self.setSelectedItem(getGamePadShortcut().item);
                        setGamePadShortcut(null);
                    } else {
                        self.joystickX = 0;
                        self.joystickY = 0;
                    }
                }
                return;
            } else if (self.jqMenuWindow.is(':visible')) {
                if (self.selectedItem) self.selectedItem.trigger('click');
            } else if (self.jqSettingsWindow.is(':visible')) {
                if (self.selectedItem) {
                    self.selectedItem.trigger('click');
                }
            } else if (self.mainButtonsActive) {
                log.info('self.mainButtonsActive');
                if (self.selectedItem) {
                    self.selectedItem.trigger('click');

                    /*if (self.selectedItem.attr('id') === 'charactermenu')
              {
                self.setSelectedItem($("#inventorybutton"));
              }*/
                    /*if (self.selectedItem[0].id === 'shortcutbutton')
              {
                self.shortcutActive = true;
              }*/
                    self.dialogOpen(self.jqCharacterMenu);
                }
                self.mainButtonsActive = false;
            }
            self.joystickX = 0;
            self.joystickY = 0;
        } else {
            if (self.navMouse) game.click();
            else game.makePlayerInteractNextTo();
        }
    });
}

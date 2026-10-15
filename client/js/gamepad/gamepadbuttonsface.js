// This file is part of Land of Mana (https://github.com/Langerz82/retrorpgonline2-client).
// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2023-2026 Joshua Langley and contributors
// Portions derived from BrowserQuest (Little Workshop) and BrowserQuest-Asky, MPL-2.0.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, version 3 of the License.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program. See the LICENSE file in the project root,
// or <https://www.gnu.org/licenses/>.

// Extracted from gamepad.js/gamepadbuttons.js: select/x/y face-button bindings
// plus the shared pressShortcut() helper they (and 'a'/'b') call.
// Installed once from gamepad.js's constructor via install*(self).
import { setGamePadShortcut } from './gamepad.js';
/* global DragItem, ShortcutData, game, log */

export function installGamepadButtonsFace(self) {
    // Selector lookups used repeatedly inside the button handlers below - cached once here
    // (installGamepadButtonsFace runs once, from Gamepad's constructor) as properties on
    // `self` (the Gamepad instance) instead of re-querying the DOM on every button press.
    // jqBankWindow/jqInventoryWindow/jqSkillWindow/jqCharacterMenu are already set on `self`
    // by Gamepad's constructor (gamepad.js) before this function runs.
    self.jqInventoryGoldFrame = $('#allinventorywindow .inventoryGoldFrame');
    self.jqBankGoldFrame = $('#bankGoldFrame');
    self.jqInvActionButton = $('#invActionButton');
    self.jqBankDialogStoreButton = $('#bankDialogStoreButton');

    self.pxgamepad.buttonOn('select', function () {
        log.info('buttonOn = select');
        if (self.mainButtonsActive) {
            self.mainButtonsActive = false;
            self.setSelectedItem(null);
            return;
        }

        self.setSelectedItem(self.jqCharacterMenu);
        self.mainButtonsActive = true;
        self.joystickX = 0;
        self.joystickY = 0;
    });

    self.pressShortcut = function (index) {
        self.setSelectedItem($(self.playerShortcut[index]));
        self.selectedItem.trigger('click');
    };

    self.pxgamepad.buttonOn('x', function () {
        if (self.leftTopPressed) {
            self.pressShortcut(2);
            return;
        }
        if (self.rightTopPressed) {
            return;
        }

        if (self.jqInventoryWindow.is(':visible')) {
            if (!DragItem) self.selectedItem.trigger('click');
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

            self.jqInventoryGoldFrame.trigger('click');
            return;
        }

        if (self.jqSkillWindow.is(':visible')) {
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

        if (self.jqBankWindow.is(':visible')) {
            self.jqBankGoldFrame.trigger('click');
            return;
        }

        log.info('buttonOn = x');
        game.playerTargetClosestEntity(1);
    });

    self.pxgamepad.buttonOff('x', function () {
        log.info('buttonOff = x');
    });

    self.pxgamepad.buttonOn('y', function () {
        if (self.leftTopPressed) {
            self.pressShortcut(3);
            return;
        }
        if (self.rightTopPressed) {
            return;
        }

        if (self.jqInventoryWindow.is(':visible')) {
            self.jqInvActionButton.trigger('click');
        }
        if (self.jqBankWindow.is(':visible')) {
            self.jqBankDialogStoreButton.trigger('click');
        }

        log.info('buttonOn = y');
        self.navMouse = !self.navMouse;
    });

    self.pxgamepad.buttonOff('y', function () {
        log.info('buttonOff = y');
    });
}

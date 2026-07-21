// Extracted from gamepad.js/gamepadbuttons.js: select/x/y face-button bindings
// plus the shared pressShortcut() helper they (and 'a'/'b') call.
// Installed once from gamepad.js's constructor via install*(self).
import {
  setGamePadShortcut, jqBankWindow, jqInventoryWindow, jqSkillWindow
} from './gamepad.js';
/* global DragItem, ShortcutData, game, log */

export function installGamepadButtonsFace(self) {
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
}

// Converted from AMD (define) + Class.extend to a native ES6 module/class.
// TODO - Add Menu Option Navigation. (Assign Skill, Add stat points, Change Settings, View Leaderboard etc).
/* global Utils, game, log, DragItem, ShortcutData, ShortcutStyle, PxGamepad */

export const Navigate = {
    NONE: 0,
    LEFT: 1,
    RIGHT: 2,
    UP: 3,
    DOWN: 4
};

// FIX: was a bare global assignment (no var), which throws ReferenceError under ES module
// strict mode. Kept private here (not exported directly) since ES module imports are
// read-only live bindings - gamepadbuttons.js, which needs to reassign this, goes through
// the getGamePadShortcut()/setGamePadShortcut() functions below instead.
let GamePadShortcut = null;

export function getGamePadShortcut() {
    return GamePadShortcut;
}
export function setGamePadShortcut(v) {
    GamePadShortcut = v;
}

// PERF: previously declared as a closure inside interval(), which runs once per game tick
// whenever a gamepad is connected - that allocated a new function object every ~1 tick for no
// reason, since it doesn't capture any per-instance state (`stick`/`deadzone` are just
// parameters). Hoisted to a module-level function so it's created once.
function applyDeadZone(stick, deadzone) {
    const dzx = Math.abs(stick.x);
    if (dzx < deadzone) stick.x = 0;
    const dzy = Math.abs(stick.y);
    if (dzy < deadzone) stick.y = 0;
}

export const jqInventoryWindow = $('#allinventorywindow');
export const jqMenuWindow = $('#menucontainer');
export const jqSkillWindow = $('#skillsDialog');
export const jqStatWindow = $('#statsDialog');
export const jqPlayerPopupWindow = $('#playerPopupMenuContainer');
const jqInviteWindow = $('#partyconfirm');
export const jqQuestWindow = $('#questlog');
export const jqSocialWindow = $('#socialwindow');
export const jqSettingsWindow = $('#settings');
export const jqLeaderWindow = $('#leaderboard');
export const jqDropWindow = $('#dropDialog');
const jqInputWindow = $('#inputDialog');
export const jqConfirmWindow = $('#dialogModalConfirm');
export const jqNotifyWindow = $('#dialogModalNotify');
export const jqDiedWindow = $('#diedwindow');
export const jqAuctionSellWindow = $('#auctionSellDialog');
export const jqAchievementWindow = $('#achievementlog');
export const jqShopWindow = $('#shopDialog');
export const jqBankWindow = $('#bankDialog');
export const jqLooksWindow = $('#appearanceDialog');
export const jqLooksPreview = $('#looksDialogPlayer');

const selectFirstItem = {
    socialconfirm: '#socialconfirmyes',
    diedwindow: '#respawn',
    dialogModalConfirm: '#dialogModalConfirmButton1',
    dialogModalNotify: '#dialogModalNotifyButton1',
    dropDialog: '#dropAccept',
    playerPopupMenuContainer: '#playerPopupMenuPartyInvite',

    allinventorywindow: '#equipBackground0',
    statsDialog: '#charAddAttack',
    skillsDialog: '#skill0 div.skillbody',
    questlog: '#questCloseButton',
    socialwindow: '#socialclose',
    settings: '#settingchat',
    auctionSellDialog: '#auctionSellAccept',
    bankDialog: '#bankDialogBank0Background',
    appearanceDialog: '#storeDialogStore1Button',
    craftDialog: '#craftDialogStore0Button',
    shopDialog: '#shopSKU',
    storeDialog: '#storeDialogStore0Button',

    menucontainer: '#inventorybutton',

    shortcut_bar: '#shortcut0',
    combatContainer: '#shortcut0'
};

// Gamepad's own behavior is split across these mixin modules for readability (gamepad.js
// had grown to ~1270 lines, almost entirely inside the constructor). Unlike the plain-
// function install*(Class.prototype) mixins used elsewhere in this codebase, this class
// builds its methods as per-instance closures (self.xxx = function(){}) rather than
// prototype methods, so these are imported as plain functions instead:
//  - runGamepadNavigation(self, navigate): the funcNavigation() UI-context dispatch
//  - installGamepadButtons(self): registers all the PxGamepad button handlers
import { runGamepadNavigation } from './gamepadnavigation.js';
import { installGamepadButtonsFace } from './gamepadbuttonsface.js';
import { installGamepadButtonsAction } from './gamepadbuttonsaction.js';
import { installGamepadButtonsCancel } from './gamepadbuttonscancel.js';
import { installGamepadButtonsDpad } from './gamepadbuttonsdpad.js';

export default class Gamepad {
    constructor(game) {
        const self = this;

        self.shopPageIndex = 0;
        self.craftPageIndex = 0;
        self.invPageIndex = 0;
        self.storeDialogSide = [
            '#storeDialogStore0Button',
            '#storeDialogStore1Button',
            '#storeDialogStore2Button',
            '#storeDialogStore3Button'
        ];
        self.looksDialogSide = [
            '#storeDialogStore0Button',
            '#storeDialogStore3Button'
        ];
        self.craftDialogButtons = '#craftDialogStore{0}Button';
        self.storeDialogBuyButton = '#storeDialogStore{0}BuyButton';

        self.bankPages = [
            '#bankDialog0Button',
            '#bankDialog1Button',
            '#bankDialog2Button',
            '#bankDialog3Button',
            '#bankDialogStoreButton',
            '#bankGoldFrame'
        ];
        self.bankPageIndex = 0;

        self.playerInventory = '#inventoryitembackground{0}';
        self.playerBank = '#bankDialogBank{0}Background';
        self.playerEquipment = [
            '#equipBackground0',
            '#equipBackground1',
            '#equipBackground2',
            '#equipBackground3',
            '#equipBackground4'
        ];
        self.playerShortcut = [
            '#attack-shortcut',
            '#scbackground0',
            '#scbackground1',
            '#scbackground2',
            '#scbackground3',
            '#scbackground4',
            '#scbackground5'
        ];

        self.playerDialogSkill = '#skill{0} div.skillbody';
        self.playerDialogStat = [
            '#charAddAttack',
            '#charAddDefense',
            '#charAddHealth',
            /*"#charAddEnergy",*/ '#charAddLuck'
        ];
        self.playerSettings = [
            '#buttonchat',
            '#buttonsound',
            '#buttonjoystick',
            '#buttonmenucolor',
            '#buttonbuttoncolor'
        ];
        self.leaderboardselect = ['#lbselect', '#lbindex'];

        self.mainButtonsActive = false;
        self.mainButtons = ['#charactermenu', '#chatbutton'];

        self.menuButtons = [
            '#inventorybutton',
            '#characterbutton',
            '#skillbutton',
            '#helpbutton',
            '#achievementbutton',
            '#socialbutton',
            '#warpbutton',
            '#settingsbutton',
            '#storebutton'
        ];

        self.navMouse = false;

        self.navigate = Navigate.NONE;
        self.navNone = false;

        self.movePad = false;

        self.shortcutAssign = 0;
        self.selectedItem = null;
        self.dpadX = 0;
        self.dpadY = 0;

        self.resetNavInterval = function (speed) {
            clearInterval(self.navInterval);
            self.navInterval = setInterval(function () {
                self.funcNavigation();
            }, speed);
        };

        self.funcNavigation = function () {
            if (self.navNone) {
                return;
            }
            if (!self.isActive()) {
                return;
            }

            const navigate = self.navigate;

            runGamepadNavigation(self, navigate);
        };

        self.setSelectedItem = function (val) {
            //{
            const defHighlight = '3px solid rgb(0, 0, 255)';
            if (self.selectedItem) {
                if (
                    !GamePadShortcut ||
                    GamePadShortcut.item !== self.selectedItem
                ) {
                    self.selectedItem.css('border', self.selectedItemBorder);
                    self.selectedItemBorder = null;
                }
            }

            if (val) {
                self.selectedItemBorder = val.css('border');
                val.css({ border: defHighlight });
                self.selectedItem = val;
            }
            //}
        };

        self.pxgamepad = new PxGamepad();

        self.pxgamepad.start();

        self.joystickSide = 0;
        self.joystickIndex = 0;
        self.joystickX = 0;
        self.joystickY = 0;
        self.dpadActive = false;
        /*if (self.pxgamepad.getGamepad())
	{
		self.enableSelectItem();
	}*/

        installGamepadButtonsFace(self);
        installGamepadButtonsAction(self);
        installGamepadButtonsCancel(self);
        installGamepadButtonsDpad(self);
    }

    interval() {
        if (this.pxgamepad.getGamepad() === null) return;

        const self = this;

        self.pxgamepad.update();

        applyDeadZone(self.pxgamepad.leftStick, 0.1);
        applyDeadZone(self.pxgamepad.rightStick, 0.1);

        self.navigate = Navigate.NONE;

        const p = game.player;
        if (!p || !game.started || !game.ready) return;

        const o = p.orientation;
        if (game.joystick && game.usejoystick) {
            if (!game.joystick.isActive()) {
                self.navigate = Navigate.NONE;
            }
            if (game.joystick.right()) {
                self.navigate = Navigate.RIGHT;
            }
            if (game.joystick.left()) {
                self.navigate = Navigate.LEFT;
            }
            if (game.joystick.up()) {
                self.navigate = Navigate.UP;
            }
            if (game.joystick.down()) {
                self.navigate = Navigate.DOWN;
            }
        }
        if (game.joystick && game.joystick.isActive()) {
            clearInterval(game.autotalk);
        }

        const ignorezone = 0.25;
        const modx = self.dpadX || self.pxgamepad.leftStick.x,
            mody = self.dpadY || self.pxgamepad.leftStick.y;

        const modxa = Math.abs(modx),
            modya = Math.abs(mody);
        const mod = Math.max(modxa, modya);
        if (mod > ignorezone) {
            if (modxa > modya) {
                self.navigate = modx > 0 ? Navigate.RIGHT : Navigate.LEFT;
            } else {
                self.navigate = mody > 0 ? Navigate.DOWN : Navigate.UP;
            }
        }

        const mouse = game.mouse,
            width = game.renderer.renderer.screen.width,
            height = game.renderer.renderer.screen.height,
            ts = G_TILESIZE,
            speed = (ts >> 3) * game.renderer.scale;

        const modx2 = self.navMouse
                ? self.dpadX || self.pxgamepad.leftStick.x
                : self.pxgamepad.rightStick.x,
            mody2 = self.navMouse
                ? self.dpadY || self.pxgamepad.leftStick.y
                : self.pxgamepad.rightStick.y;
        const modxa2 = Math.abs(modx2),
            modya2 = Math.abs(mody2),
            mod2 = Math.max(modxa2, modya2);

        if (mod2 > ignorezone) {
            mouse.x += modx2 * speed;
            mouse.y += mody2 * speed;
        }

        game.mouse.x = ~~Utils.clamp(0, width - 1, mouse.x);
        game.mouse.y = ~~Utils.clamp(0, height - 1, mouse.y);

        const navigate = self.navigate;

        if (!self.isDialogOpen() && !self.navMouse) {
            if (!game.player.keyMove) {
                if (navigate === Navigate.LEFT) {
                    p.move(3, true);
                    this.movePad = 3;
                }
                if (navigate === Navigate.RIGHT) {
                    p.move(4, true);
                    this.movePad = 4;
                }
                if (navigate === Navigate.UP) {
                    p.move(1, true);
                    this.movePad = 1;
                }
                if (navigate === Navigate.DOWN) {
                    p.move(2, true);
                    this.movePad = 2;
                }
            }
            // FIX: `>` binds tighter than `&`, so this was parsing as
            // `p.keyMove & (this.movePad > 0)` (bitwise-AND against a 0/1 boolean) instead of
            // the intended "movePad bit is set" check `(p.keyMove & this.movePad) > 0`. Broke
            // detection of a released gamepad-driven walk direction.
            if (
                navigate === Navigate.NONE &&
                navigate === Navigate.NONE &&
                (p.keyMove & this.movePad) > 0
            ) {
                p.move(this.movePad, false);
                this.movePad = 0;
            }
        }

        game.movecursor();
        game.updateCursorLogic();

        /*if (!self.isDialogOpen()) {
        self.funcNavigation();
      }*/

        if (navigate !== 0) {
            if (!self.navInterval) self.funcNavigation();
            if (self.navInterval == null) self.resetNavInterval(200);
        } else {
            clearInterval(self.navInterval);
            self.navInterval = null;
        }
    }

    isDialogOpen() {
        return (
            game.storeDialog.visible ||
            game.bankDialog.visible ||
            game.auctionDialog.visible ||
            game.appearanceDialog.visible ||
            game.craftDialog.visible ||
            jqMenuWindow.is(':visible') ||
            jqInventoryWindow.is(':visible') ||
            jqSkillWindow.is(':visible') ||
            jqStatWindow.is(':visible') ||
            jqPlayerPopupWindow.is(':visible') ||
            jqInviteWindow.is(':visible') ||
            jqQuestWindow.is(':visible') ||
            jqAchievementWindow.is(':visible') ||
            jqSocialWindow.is(':visible') ||
            jqSettingsWindow.is(':visible') ||
            jqLeaderWindow.is(':visible') ||
            jqDropWindow.is(':visible') ||
            jqInputWindow.is(':visible') ||
            jqConfirmWindow.is(':visible') ||
            jqNotifyWindow.is(':visible') ||
            jqAuctionSellWindow.is(':visible') ||
            jqDiedWindow.is(':visible') ||
            jqShopWindow.is(':visible') ||
            jqLooksWindow.is(':visible') ||
            jqLooksPreview.is(':visible') ||
            this.mainButtonsActive
        );
    }

    isActive() {
        return this.pxgamepad.getGamepad() !== null;
    }

    navActive() {
        if (this.pxgamepad.getGamepad() === null) return true;
        return this.navigate !== 0;
    }

    dialogNavigate(direction) {
        this.joystickSide = 0;
        this.joystickIndex = 0;
        this.joystickX = 0;
        this.joystickY = 0;
    }

    dialogOpen(dialog) {
        this.setSelectedItem(null);
        for (let k in selectFirstItem) {
            if ($('#' + k).is(':visible')) {
                this.setSelectedItem($(selectFirstItem[k]));
                break;
            }
        }
        this.dialogNavigate();
    }

    dialogClose() {}
}

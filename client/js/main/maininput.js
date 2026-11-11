// This file is part of Land of Mana (https://github.com/Langerz82/landofmana).
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

// Extracted from main.js: touch/mouse input on the game canvas, the keyboard() helper
// (WASD/arrow movement key press/release), fnKeyAction (shortcut keys, enter/escape
// dialog routing), and the keydown/focus handlers for the various modal dialogs/inputs
// that respond to keyboard events.
// Called once from main.js's initGame(); reads/writes the same bare `game`/`app` globals
// every other file in this codebase uses (see globalstate.js), not passed as parameters.
/* global Types, game, app */
// FIX: Detect.isFirefoxAndroid() is called below but this module never imported Detect,
// so every chat-input focus event threw "ReferenceError: Detect is not defined" and the
// placeholder-restore logic that follows it never ran, on any browser.
import Detect from '../detect.js';

export function installMainInput() {
    $(document).bind('mousedown', function (event) {
        if (event.button === 2) {
            return false;
        }
    });
    $(document).bind('mouseup', function (event) {
        if (event.button === 2 && game.ready) {
            return false;
        }
    });

    const jqGame = $('#game');

    let touchX, touchY;
    jqGame.on('touchstart', function (e) {
        const r = game.renderer;
        game.playerClick = false;

        const dpr = window.devicePixelRatio || 1;
        const touch = e.touches[0];
        const rect = this.getBoundingClientRect();

        const scaleX = this.width / rect.width;
        const scaleY = this.height / rect.height;

        const x = (touch.clientX - rect.left) * scaleX;
        const y = (touch.clientY - rect.top) * scaleY;

        app.setMouseCoordinates(x, y);

        if (game.started) {
            game.movecursor();
        }
        game.click();
        e.preventDefault();
    });

    jqGame.on('touchmove', function (e) {});

    jqGame.on('touchend', function (e) {});

    jqGame.on('click', function (e) {
        game.click();
        e.preventDefault();
    });

    jqGame.mousemove(function (e) {
        const x = e.offsetX;
        const y = e.offsetY;
        app.setMouseCoordinates(x, y);
        if (game.started) {
            game.updateCursor();
        }
    });

    const jqChatbox = $('#chatbox');
    const jqDropDialog = $('#dropDialog');
    const jqChatInput = $('#chatinput');
    const jqForeground = $('#foreground');
    const jqUserWindow = $('#user_window');
    const jqPlayerWindow = $('#player_window');
    const jqInput = $('input');
    const jqPlayerCreateForm = $('#player_create_form');
    const jqPlayerLoad = $('#player_load');
    const jqDropAccept = $('#dropAccept');
    const jqDropCancel = $('#dropCancel');
    const jqAuctionSellDialog = $('#auctionSellDialog');
    const jqDialogModalNotify = $('#dialogModalNotify');
    const jqDialogModalConfirm = $('#dialogModalConfirm');
    const jqDialogModalNotifyButton1 = $('#dialogModalNotifyButton1');
    const jqDialogModalConfirmButton1 = $('#dialogModalConfirmButton1');
    const jqDialogModalConfirmButton2 = $('#dialogModalConfirmButton2');
    const jqErrorWindow = $('#errorwindow');
    const jqAuctionSellAccept = $('#auctionSellAccept');
    const jqAuctionSellCancel = $('#auctionSellCancel');
    const jqDropCount = $('#dropCount');
    const jqDiedWindow = $('#diedwindow');
    const jqRespawn = $('#respawn');

    const jqShortcut = [];
    for (let i = 0; i < 8; ++i) jqShortcut[i] = $('#shortcut' + i);

    const fnCondition = function () {
        return (
            game.player &&
            game.started &&
            game.mapStatus >= 2 &&
            !jqChatbox.hasClass('active') &&
            !jqDropDialog.is(':visible') &&
            !jqAuctionSellDialog.is(':visible') &&
            !jqDialogModalNotify.is(':visible') &&
            !jqDialogModalConfirm.is(':visible')
        );
    };

    // A teleport is loading (the game would have the keyboard otherwise).
    const fnLoading = function () {
        return !!(game.player && game.started && game.mapStatus < 2 && !jqChatbox.hasClass('active'));
    };

    const keyboard = function (value) {
        const key = {
            value: value,
            isDown: false,
            isUp: true,
            // when the key last went down (app.resumeHeldKeys() picks the most recent held one)
            downAt: 0,
            press: undefined,
            release: undefined
        };

        //The `downHandler`
        key.downHandler = function (event) {
            if (!fnCondition()) {
                // Pressed while a teleport is loading: the player can't move yet, but remember the key is
                // down so app.resumeHeldKeys() moves the player with it once the teleport has finished.
                if (fnLoading()) {
                    for (let k of key.value) {
                        if (event.which === k) {
                            if (key.isUp) key.downAt = Date.now();
                            key.isDown = true;
                            key.isUp = false;
                        }
                    }
                }
                return;
            }

            for (let k of key.value) {
                if (event.which === k) {
                    if (key.isUp) key.downAt = Date.now();
                    if (key.isUp && key.press) {
                        key.press();
                    }
                    key.isDown = true;
                    key.isUp = false;
                    event.preventDefault();
                    event.stopPropagation();
                }
            }
        };

        //The `upHandler`
        // FIX: a release used to be dropped whenever fnCondition() was false -- in particular while a
        // teleport was loading (mapStatus < 2) -- so the key stayed "down" here although it had been let go:
        // once the teleport finished, app.resumeHeldKeys() started walking with it and no release ever came
        // to stop the player. A release always counts now (player.move(o, false) is safe at any time, and
        // only clears the key state while teleporting); it's only consumed when the game has the keyboard.
        key.upHandler = function (event) {
            const mine = fnCondition();

            for (let k of key.value) {
                if (event.which === k) {
                    if (key.isDown && key.release) {
                        key.release();
                    }
                    key.isDown = false;
                    key.isUp = true;
                    if (key.onUp) key.onUp();
                    if (mine) {
                        event.preventDefault();
                        event.stopPropagation();
                    }
                }
            }
        };

        //Attach event listeners
        const downListener = key.downHandler.bind(key);
        const upListener = key.upHandler.bind(key);

        window.addEventListener('keydown', downListener, false);
        window.addEventListener('keyup', upListener, false);

        // Detach event listeners
        key.unsubscribe = () => {
            window.removeEventListener('keydown', downListener);
            window.removeEventListener('keyup', upListener);
        };

        return key;
    };

    const fnKeyLeft = keyboard([
        Types.Keys.LEFT,
        Types.Keys.A,
        Types.Keys.KEYPAD_4
    ]);
    fnKeyLeft.press = function () {
        game.player.move(Types.Orientations.LEFT, true);
    };
    fnKeyLeft.release = function () {
        game.player.move(Types.Orientations.LEFT, false);
    };

    const fnKeyRight = keyboard([
        Types.Keys.RIGHT,
        Types.Keys.D,
        Types.Keys.KEYPAD_6
    ]);
    fnKeyRight.press = function () {
        game.player.move(Types.Orientations.RIGHT, true);
    };
    fnKeyRight.release = function () {
        game.player.move(Types.Orientations.RIGHT, false);
    };

    const fnKeyUp = keyboard([
        Types.Keys.UP,
        Types.Keys.W,
        Types.Keys.KEYPAD_8
    ]);
    fnKeyUp.press = function () {
        game.player.move(Types.Orientations.UP, true);
    };
    fnKeyUp.release = function () {
        game.player.move(Types.Orientations.UP, false);
    };

    const fnKeyDown = keyboard([
        Types.Keys.DOWN,
        Types.Keys.S,
        Types.Keys.KEYPAD_2
    ]);
    fnKeyDown.press = function () {
        game.player.move(Types.Orientations.DOWN, true);
    };
    fnKeyDown.release = function () {
        game.player.move(Types.Orientations.DOWN, false);
    };

    const moveKeys = [fnKeyRight, fnKeyLeft, fnKeyUp, fnKeyDown];

    app.releaseKeys = function () {
        for (let k of moveKeys) {
            k.isDown = false;
            k.isUp = true;
        }
    };

    // Once a teleport has finished: a movement key held through it (or pressed while it was loading -- the
    // player can't move then, see player.move()) moves the player now, without having to be pressed again.
    // The most recently pressed one wins. Returns whether any movement key is held.
    app.resumeHeldKeys = function () {
        let last = null;
        for (let k of moveKeys) {
            if (k.isDown && (!last || k.downAt > last.downAt)) last = k;
        }
        if (last && last.press) last.press();
        return !!last;
    };

    app.anyMoveKeyDown = function () {
        return moveKeys.some((k) => k.isDown);
    };

    // Letting go of every movement key re-arms the door the player was teleported onto (see the arrival-door
    // guard in clientcallbacksmap.js / checkTeleport in gamecallbacks.js).
    const onMoveKeyUp = function () {
        const p = game.player;
        if (p && p.arrivalDoorGuard && !app.anyMoveKeyDown()) p.arrivalDoorGuard.untilRelease = false;
    };
    for (let k of moveKeys) k.onUp = onMoveKeyUp;

    const fnKeyAction = function (e) {
        const key = e.which;

        if (key === Types.Keys.ENTER) {
            // Enter
            if (jqDialogModalNotify.is(':visible')) {
                jqDialogModalNotifyButton1.trigger('click');
                return false;
            } else if (jqDialogModalConfirm.is(':visible')) {
                jqDialogModalConfirmButton1.trigger('click');
                return false;
            } else if (game.started) {
                app.showChat(!jqChatbox.hasClass('active'));
                return false; // prevent form submit.
            }
        }

        if (key === Types.Keys.ESCAPE) {
            // FIX: copy-paste bug - both branches checked jqDialogModalConfirm, so Escape did nothing while the
            // notify dialog was visible and wrongly clicked the notify button while the confirm dialog was visible.
            // First branch now checks jqDialogModalNotify, matching the parallel ENTER-key handler above.
            if (jqDialogModalNotify.is(':visible')) {
                jqDialogModalNotifyButton1.trigger('click');
                return false;
            } else if (jqDialogModalConfirm.is(':visible')) {
                jqDialogModalConfirmButton2.trigger('click');
                return false;
            }
        }

        if (fnCondition()) {
            switch (key) {
                case Types.Keys.T:
                    game.playerTargetClosestEntity(1);
                    return false;
                case Types.Keys.Y:
                    game.playerTargetClosestEntity(-1);
                    return false;
                case Types.Keys.SPACE:
                    game.makePlayerInteractNextTo();
                    return false;
                case Types.Keys.KEY_1:
                    jqShortcut[0].trigger('click');
                    return false;
                case Types.Keys.KEY_2:
                    jqShortcut[1].trigger('click');
                    return false;
                case Types.Keys.KEY_3:
                    jqShortcut[2].trigger('click');
                    return false;
                case Types.Keys.KEY_4:
                    jqShortcut[3].trigger('click');
                    return false;
                case Types.Keys.KEY_5:
                    jqShortcut[4].trigger('click');
                    return false;
                case Types.Keys.KEY_6:
                    jqShortcut[5].trigger('click');
                    return false;
                case Types.Keys.KEY_7:
                    jqShortcut[6].trigger('click');
                    return false;
                case Types.Keys.KEY_8:
                    jqShortcut[7].trigger('click');
                    return false;
                default:
                    break;
            }
        }
    };

    $(document).keydown(function (e) {
        if (e.repeat) {
            return true;
        }
        return fnKeyAction(e);
    });

    jqPlayerWindow.keydown(function (e) {
        if (e.which === 13) {
            jqInput.blur();
            if (jqPlayerCreateForm.is(':visible')) app.tryPlayerAction(4);
            else if (jqPlayerLoad.is(':visible')) app.tryPlayerAction(3);
            return false;
        }
    });

    jqUserWindow.keydown(function (e) {
        if (e.which === 13 && app.userReady) {
            jqInput.blur(); // exit keyboard on mobile
            app.tryUserAction(1);
            return false;
        }
    });

    jqErrorWindow.keydown(function (e) {
        if (e.which === 13) {
            location.reload();
            return false;
        }
    });

    jqAuctionSellDialog.keydown(function (e) {
        const key = e.which;
        if (key === Types.Keys.ENTER) {
            jqAuctionSellAccept.trigger('click');
            return false;
        } else if (key === Types.Keys.ESCAPE) {
            jqAuctionSellCancel.trigger('click');
            return false;
        }
    });

    jqDropCount.keydown(function (e) {
        const key = e.which;
        if (key === Types.Keys.ENTER) {
            jqDropAccept.trigger('click');
            return false;
        } else if (key === Types.Keys.ESCAPE) {
            jqDropCancel.trigger('click');
            return false;
        }
    });

    jqDiedWindow.keydown(function (e) {
        if (e.which === Types.Keys.ENTER) {
            jqRespawn.trigger('click');
            return false;
        }
    });

    jqChatInput.keydown(function (e) {
        if (e.repeat) {
            return;
        }
        const key = e.which,
            placeholder = $(this).attr('placeholder');

        if (key === 13) {
            if (jqChatInput.val() !== '') {
                if (game.player) {
                    game.say(jqChatInput.val());
                }
                jqChatInput.val('');
                app.showChat(false);
                return false;
            } else {
                app.showChat(false);
                return false;
            }
        }

        if (key === 27) {
            app.showChat(false);
            return false;
        }
    });

    jqChatInput.focus(function (e) {
        const placeholder = $(this).attr('placeholder');

        if (!Detect.isFirefoxAndroid()) {
            $(this).val(placeholder);
        }

        if ($(this).val() === placeholder) {
            this.setSelectionRange(0, 0);
        }
    });
}

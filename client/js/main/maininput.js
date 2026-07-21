// Extracted from main.js: touch/mouse input on the game canvas, the keyboard() helper
// (WASD/arrow movement key press/release), fnKeyAction (shortcut keys, enter/escape
// dialog routing), and the keydown/focus handlers for the various modal dialogs/inputs
// that respond to keyboard events.
// Called once from main.js's initGame(); reads/writes the same bare `game`/`app` globals
// every other file in this codebase uses (see globalstate.js), not passed as parameters.
/* global Types, game, app */

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

    const keyboard = function (value) {
        const key = {
            value: value,
            isDown: false,
            isUp: true,
            press: undefined,
            release: undefined
        };

        //The `downHandler`
        key.downHandler = function (event) {
            if (!fnCondition()) return;

            for (let k of key.value) {
                if (event.which === k) {
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
        key.upHandler = function (event) {
            if (!fnCondition()) return;

            for (let k of key.value) {
                if (event.which === k) {
                    if (key.isDown && key.release) {
                        key.release();
                    }
                    key.isDown = false;
                    key.isUp = true;
                    event.preventDefault();
                    event.stopPropagation();
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

    app.releaseKeys = function () {
        const key = [fnKeyRight, fnKeyLeft, fnKeyUp, fnKeyDown];
        for (let k of key) {
            k.isDown = false;
            k.isUp = true;
        }
    };

    const fnKeyAction = function (e) {
        const key = e.which;

        if (key === Types.Keys.ENTER) {
            // Enter
            if (jqDialogModalNotify.is(':visible')) {
                $('#dialogModalNotifyButton1').trigger('click');
                return false;
            } else if (jqDialogModalConfirm.is(':visible')) {
                $('#dialogModalConfirmButton1').trigger('click');
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
                $('#dialogModalNotifyButton1').trigger('click');
                return false;
            } else if (jqDialogModalConfirm.is(':visible')) {
                $('#dialogModalConfirmButton2').trigger('click');
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

    $('#errorwindow').keydown(function (e) {
        if (e.which === 13) {
            location.reload();
            return false;
        }
    });

    $('#auctionSellDialog').keydown(function (e) {
        const key = e.which;
        if (key === Types.Keys.ENTER) {
            $('#auctionSellAccept').trigger('click');
            return false;
        } else if (key === Types.Keys.ESCAPE) {
            $('#auctionSellCancel').trigger('click');
            return false;
        }
    });

    $('#dropCount').keydown(function (e) {
        const key = e.which;
        if (key === Types.Keys.ENTER) {
            jqDropAccept.trigger('click');
            return false;
        } else if (key === Types.Keys.ESCAPE) {
            jqDropCancel.trigger('click');
            return false;
        }
    });

    $('#diedwindow').keydown(function (e) {
        if (e.which === Types.Keys.ENTER) {
            $('#respawn').trigger('click');
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

    $('#chatinput').focus(function (e) {
        const placeholder = $(this).attr('placeholder');

        if (!Detect.isFirefoxAndroid()) {
            $(this).val(placeholder);
        }

        if ($(this).val() === placeholder) {
            this.setSelectionRange(0, 0);
        }
    });
}

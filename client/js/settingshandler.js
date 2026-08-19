// Converted from AMD (define) + Class.extend to a native ES6 module/class.
// NOTE: 'lib/virtualjoystick' is still loaded as a classic (non-module) script via a <script> tag
// and exposes `VirtualJoystick` as a global, so it is not imported here. `localforage` is now
// imported (for its window.localforage side effect) once from app.js, which the import graph
// guarantees runs before this file, so it's still safe to use here as a bare global.
/* global localforage, VirtualJoystick, log, ShortcutStyle */
export default class SettingsHandler {
    constructor(game) {
        this.game = game;
        this.app = game.app;
        this.toggle = false;
        const self = this;

        this.jqSettings = $('#settings');

        const jqSettingsClose = $('#settingsclose');
        jqSettingsClose.click(function (e) {
            self.show();
        });

        // FIX: removed dead commented-out #buttonsound click handler (superseded by the buttonSound binding below)
        this.funcSound = function (bSound) {
            if (self.game && self.game.audioManager) {
                self.game.audioManager.toggle(bSound);
            }
        };

        // FIX: cached on `this` (not a constructor-local const) because apply() also needs
        // this same element and used to perform a second, redundant $('#buttonsound') lookup.
        this.jqButtonSound = $('#buttonsound');
        this.jqButtonSound.click(function (e) {
            if ($(this).hasClass('active')) {
                $(this).html('Off');
                $(this).removeClass('active');
                self.funcSound(false);
                localforage.setItem('sound', 0);
            } else {
                $(this).html('On');
                $(this).addClass('active');
                self.funcSound(true);
                localforage.setItem('sound', 1);
            }
        });

        const funcChat = function (bChat) {
            if (self.game) {
                // FIX: branches were swapped (bChat=true called hideChatLog); every other toggle here (funcSound,
                // funcJoystick) treats b<Feature>=true as "show/enable", so this was backwards
                if (bChat) {
                    app.showChatLog();
                } else {
                    app.hideChatLog();
                }
            }
        };

        const jqButtonChat = $('#buttonchat');
        localforage.getItem('chat', function (e, val) {
            if (!val) {
                jqButtonChat.html('Off');
                jqButtonChat.removeClass('active');
                funcChat(false);
            } else {
                jqButtonChat.html('On');
                jqButtonChat.addClass('active');
                funcChat(true);
            }
        });

        jqButtonChat.click(function (e) {
            if ($(this).hasClass('active')) {
                $(this).html('Off');
                $(this).removeClass('active');
                funcChat(false);
                localforage.setItem('chat', false);
            } else {
                $(this).html('On');
                $(this).addClass('active');
                funcChat(true);
                localforage.setItem('chat', true);
            }
        });

        const funcJoystick = function (bJoystick) {
            if (self.game) {
                if (bJoystick) {
                    self.game.usejoystick = true;
                    log.info('Loading Joystick');
                    self.game.joystick = new VirtualJoystick({
                        game: self.game,
                        container: document.getElementById('canvas'),
                        mouseSupport: true
                    });
                } else {
                    self.game.usejoystick = false;
                    self.game.joystick = null;
                    VirtualJoystick._touchIdx = null;
                }
            }
        };

        const jqButtonJoystick = $('#buttonjoystick');
        localforage.getItem('joystick', function (e, val) {
            if (!val) {
                jqButtonJoystick.html('Off');
                jqButtonJoystick.removeClass('active');
                funcJoystick(false);
            } else {
                jqButtonJoystick.html('On');
                jqButtonJoystick.addClass('active');
                funcJoystick(true);
            }
        });

        jqButtonJoystick.click(function (e) {
            if ($(this).hasClass('active')) {
                $(this).html('Off');
                $(this).removeClass('active');
                funcJoystick(false);
                localforage.setItem('joystick', false);
            } else {
                $(this).html('On');
                $(this).addClass('active');
                funcJoystick(true);
                localforage.setItem('joystick', true);
            }
        });

        const jqRoot = $(':root');
        const changeMColor = function (val) {
            jqRoot.css('--pixel-bg', val);
        };

        const jqButtonMColor = $('#buttonmenucolor');
        localforage.getItem('menucolor', function (e, val) {
            if (!val) return;
            changeMColor(val);
            jqButtonMColor.val(val);
        });

        jqButtonMColor.change(function (e) {
            localforage.setItem('menucolor', this.value);
            changeMColor(this.value);
        });

        const jqFrameNewButton = $('div.frame-new-button');
        const changeBColor = function (val) {
            jqFrameNewButton.css('background-color', val);
        };

        const jqButtonBColor = $('#buttonbuttoncolor');
        localforage.getItem('buttoncolor', function (e, val) {
            if (!val) return;
            changeBColor(val);
            jqButtonBColor.val(val);
        });

        jqButtonBColor.change(function (e) {
            localforage.setItem('buttoncolor', this.value);
            changeBColor(this.value);
        });

        const jqGamezoom = $('#gamezoom');
        const fnSetZoom = function (val) {
            if (!game) return;
            game.zoom = val;
            game.resize(val);

            jqGamezoom.find('option:selected').removeAttr('selected');
            jqGamezoom
                .find('option[value="' + val + '"]')
                .attr('selected', true);
        };
        const jqSelectZoom = $('.cgamezoom');
        if (game) {
            localforage.getItem('gamezoom', function (e, val) {
                if (val) fnSetZoom(val);
            });
            fnSetZoom(1.0);
        }
        jqSelectZoom.change(function () {
            const val = jqGamezoom.val();
            localforage.setItem('gamezoom', val);
            fnSetZoom(val);
        });

        const jqShortcutBar = $('#shortcut_bar');
        const jqShortcutStyle = $('#shortcutstyle');
        const fnSetShortcut = function (val) {
            jqShortcutBar.removeClass();
            jqShortcutBar.addClass(val);

            jqShortcutStyle.find('option:selected').removeAttr('selected');
            jqShortcutStyle
                .find('option[value="' + val + '"]')
                .attr('selected', true);
            ShortcutStyle = val;
        };
        if (game) {
            localforage.getItem('shortcutstyle', function (e, val) {
                if (val) fnSetShortcut(val);
            });
            if (!game.isDesktop) {
                if (window.innerWidth > window.innerHeight)
                    fnSetShortcut('horizontal-desc');
                else {
                    fnSetShortcut('vertical-desc');
                }
            } else fnSetShortcut('horizontal-asc');
        }
        jqShortcutStyle.change(function () {
            const val = jqShortcutStyle.val();
            localforage.setItem('shortcutstyle', val);
            fnSetShortcut(val);
        });
    }

    apply() {
        const self = this;

        localforage.getItem('sound', function (e, val) {
            if (val === 0) {
                self.jqButtonSound.html('Off');
                self.jqButtonSound.removeClass('active');
                self.funcSound(false);
            } else {
                self.jqButtonSound.html('On');
                self.jqButtonSound.addClass('active');
                self.funcSound(true);
            }
        });
    }

    show() {
        this.toggle = !this.toggle;
        if (this.toggle) {
            this.jqSettings.css('display', 'block');
        } else {
            this.jqSettings.css('display', 'none');
        }
    }
}

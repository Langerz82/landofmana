// Converted from AMD (define) + top-level bootstrap globals to a native ES6 module.
// 'dialog/dialog' (Dialog) is not referenced directly by identifier anywhere in this file, so it
// is not imported here (consumers that need it already import dialog/dialog.js themselves).
// PIXI, $, console, StatusBar, screen, Types, Utils remain classic (non-module) globals as
// established throughout this conversion (Types/Utils are exposed via js/globaltypes.js, which
// home.js imports before this file).
import App from '../app/app.js';
import LangData from '../data/langdata.js';
import Detect from '../detect.js';
import Button2 from '../button2.js';
import Game from '../game.js';
import { installMainUI } from './mainui.js';
import { installMainInput } from './maininput.js';
import { installMainDialogs } from './maindialogs.js';

/* global Types, Utils, PIXI, StatusBar, screen */

// FIX (conversion): these were bare top-level assignments relying on non-strict/classic-script
// semantics to create window properties; ES modules are always strict mode and top-level
// var/let/const do NOT create window properties, so they are made explicit here. This is the
// canonical declaration site for these cross-file "global" identifiers (see js/globalstate.js
// for the same pattern applied to DragItem/DragBank/ShortcutData).
window.app = null;
// FIX: was `window.log = console;`, unconditionally overwriting whatever
// `log` already is. lib/log.js sets up its own level-gated Logger
// (defaulting to "error" so log.debug()/log.info() -- ~230 call sites
// across the client, including gameclient.js's per-packet recv/send
// logging -- are silent by default; see that file's own FIX comment for
// the full story) via a bare `log = new Logger("error");` assignment,
// which (since log.js runs as a classic, non-strict script) creates an
// implicit `window.log`. This file is part of the ES-module bundle, and
// module scripts always execute after classic scripts have run -- so this
// line ran *after* log.js's, unconditionally stomping the level-gated
// Logger back to plain `console`, silently undoing that entire fix and
// making every log.debug()/log.info() call fire unconditionally again in
// production. Only fall back to `console` if log.js's Logger somehow isn't
// present, instead of always overwriting it.
window.log = window.log || console;

window.G_LATENCY = 75;
window.G_ROUNDTRIP = window.G_LATENCY * 2;
window.G_UPDATE_INTERVAL = 16;
window.G_TILESIZE = 16;

window.ATTACK_INTERVAL = 1000;
window.ATTACK_MAX = 1000;

window.Container = {
    STAGE: new PIXI.Container(),
    BACKGROUND: new PIXI.Container(),
    ENTITIES: new PIXI.Container(),
    FOREGROUND: new PIXI.Container(),
    HUD: new PIXI.Container(),
    HUD2: new PIXI.Container()
};

window.Container.STAGE.interactive = false;

Object.freeze(window.Container);

// FIX (conversion): 'lang' is another canonical cross-file global declaration site (was a bare
// 'lang = new LangData("EN")').
window.lang = new LangData('EN');

const initApp = function (server) {
    const startEvents = function () {
        if (typeof StatusBar !== 'undefined') StatusBar.hide();
    };
    document.addEventListener('deviceready', startEvents, false);

    window.onbeforeunload = function (e) {
        if (typeof userclient !== 'undefined' && userclient.connection)
            userclient.connection.close();
        else if (
            typeof game !== 'undefined' &&
            game.client &&
            game.client.connection
        )
            game.client.connection.close();
    };

    $(document).ready(function () {
        app = new App();
        app.center();

        DragItem = null;
        DragBank = null;

        const jqBody = $('body');

        if (Detect.isWindows()) {
            // Workaround for graphical glitches on text
            jqBody.addClass('windows');
        }

        if (Detect.isOpera()) {
            // Fix for no pointer events
            jqBody.addClass('opera');
        }

        const jqChatInput = $('#chatinput');
        if (Detect.isFirefoxAndroid()) {
            // Remove chat placeholder
            jqChatInput.removeAttr('placeholder');
        }

        const jqBarButton = $('.barbutton');
        const jqAboutButton = $('#aboutbutton');
        const jqAboutClose = $('#aboutclose');
        // Hoisted above both click handlers below (was previously re-queried fresh inside
        // each one, on every click) since #about_window is a single static element shared by
        // both the open (aboutbutton) and close (aboutclose) handlers.
        const jqAboutWindow = $('#about_window');
        const jqChatButton = $('#chatbutton');
        const jqChatbox = $('#chatbox');
        const jqPopulation = $('#population');
        const jqClickable = $('.clickable');
        const jqChangePassword = $('#change-password');
        const jqAttackShortcut = $('#attack-shortcut');
        const jqClose = $('.close');

        jqBarButton.click(function () {
            $(this).toggleClass('active');
        });
        jqAboutButton.click(function () {
            jqAboutWindow.toggle();
        });
        jqAboutClose.click(function () {
            jqAboutWindow.hide();
        });

        jqChatButton.click(function () {
            app.showChat(!jqChatbox.hasClass('active'));
        });

        jqPopulation.click(function () {
            app.togglePopulationInfo();
        });

        jqClickable.click(function (event) {
            // FIX: handler's parameter is named `event`; `e` was undeclared and would throw a ReferenceError on click
            fnClickFunc(event);
        });

        jqChangePassword.click(function () {
            app.loadWindow('loginWindow', 'passwordWindow');
        });

        jqAttackShortcut.click(function () {
            game.makePlayerInteractNextTo();
        });

        jqClose.click(function () {
            app.hideWindows();
        });

        log.info('App initialized.');

        initGame();

        return app;
    });
};

// FIX (var cleanup): initGame() is called (line ~132) from inside a deferred callback that
// only runs after the whole module has finished evaluating, so by the time it's actually
// invoked this declaration has long since run - safe as const despite the call site appearing
// earlier in the file.
const initGame = function () {
    const canvas = document.getElementById('entities'),
        input = document.getElementById('chatinput');

    // FIX (conversion): 'game' is another canonical cross-file global declaration site (was a
    // bare 'game = new Game(app)').
    window.game = new Game(app);
    game.setup(input);

    app.setGame(game);

    // FIX: was a no-op comparison (===) instead of an assignment
    game.useServer = 'world';

    game.onGameStart(function () {});

    // Cached once here and reused by the onDisconnect/onClientError/onPlayerDeath callbacks
    // below, which fire repeatedly over the game session (each disconnect/error/death),
    // instead of re-querying the DOM on every call.
    const jqErrorWindow = $('#errorwindow');
    const jqDiedWindow = $('#diedwindow');

    game.onDisconnect(function (message) {
        jqErrorWindow
            .find('p')
            .html(message + '<em>Disconnected. Please reload the page.</em>');
        jqErrorWindow.show();
        jqErrorWindow.focus();
    });

    game.onClientError(function (message) {
        jqErrorWindow.find('p').html(message);
        jqErrorWindow.show();
        jqErrorWindow.focus();
    });

    game.onPlayerDeath(function () {
        game.player.dead();
        jqDiedWindow.show();
        jqDiedWindow.focus();
    });

    game.onNotification(function (message) {
        app.showMessage(message);
    });

    app.initHealthBar();
    app.initExpBar();
    app.initPlayerBar();

    const jqNameInput = $('#nameinput');
    const jqPwInput = $('#pwinput');
    const jqPwInput2 = $('#pwinput2');
    const jqEmailInput = $('#emailinput');
    const jqChatbox = $('#chatbox');

    jqNameInput.attr('value', '');
    jqPwInput.attr('value', '');
    jqPwInput2.attr('value', '');
    jqEmailInput.attr('value', '');
    jqChatbox.attr('value', '');

    const fnClickFunc = function (e) {
        app.center();
        app.setMouseCoordinates(e.data.global.x, e.data.global.y);
        // FIX: typo'd property name (`auctioSellDialogPopuped`) never matched app.js's `auctionsellDialogPopuped`, so this check was always true and never blocked clicks while the auction-sell dialog was open
        if (game && !app.dropDialogPopuped && !app.auctionsellDialogPopuped) {
            if (!game.usejoystick) game.click();
        }
        app.hideWindows();
        // FIX: was `event.stopPropagation()` -- this function's own parameter
        // is named `e` (see signature above), not `event`. `event` isn't
        // declared anywhere in this function or its enclosing scope, so this
        // only "worked" via the deprecated implicit `window.event` global --
        // which Firefox has never supported, so this threw
        // `ReferenceError: event is not defined` on every click through
        // `.clickable` in Firefox. This is the mirror image of the bug
        // already fixed a few lines up (line ~124), where the click handler's
        // parameter really is named `event`.
        e.stopPropagation();
    };

    $(document).ready(function () {
        const jqGui = $('#gui');
        jqGui.on('click', function (event) {
            //event.preventDefault();
        });
        game.inventoryDialog.loadInventoryEvents();
    });
    const jqRespawn = $('#respawn');
    jqRespawn.click(function (event) {
        game.audioManager.playSound('revive');
        game.respawnPlayer();
        jqDiedWindow.hide();
    });

    installMainUI();

    installMainInput();

    installMainDialogs();

    if (game.tablet) {
        const jqBody = $('body');
        jqBody.addClass('tablet');
    }

    document.addEventListener('DOMContentLoaded', function () {
        // check whether the runtime supports screen.lockOrientation
        if (screen.lockOrientation) {
            // lock the orientation
            screen.lockOrientation('landscape');
        }

        // ...rest of the application code...
    });

    // FIX (conversion): was a bare 'console = {}' fallback assignment; console is a host global
    // that always exists in browser/NW.js contexts, so this branch is unreachable in practice,
    // but the assignment is made explicit for ES module strict mode in case it ever is.
    if (typeof console === 'undefined') {
        window.console = {};
    }
};

initApp();

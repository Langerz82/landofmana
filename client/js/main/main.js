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
window.log = console;

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

        if (Detect.isWindows()) {
            // Workaround for graphical glitches on text
            $('body').addClass('windows');
        }

        if (Detect.isOpera()) {
            // Fix for no pointer events
            $('body').addClass('opera');
        }

        if (Detect.isFirefoxAndroid()) {
            // Remove chat placeholder
            $('#chatinput').removeAttr('placeholder');
        }

        $('.barbutton').click(function () {
            $(this).toggleClass('active');
        });
        $('#aboutbutton').click(function () {
            const about = $('#about_window');
            about.toggle();
        });
        $('#aboutclose').click(function () {
            const about = $('#about_window');
            about.hide();
        });

        $('#chatbutton').click(function () {
            app.showChat(!$('#chatbox').hasClass('active'));
        });

        $('#population').click(function () {
            app.togglePopulationInfo();
        });

        $('.clickable').click(function (event) {
            // FIX: handler's parameter is named `event`; `e` was undeclared and would throw a ReferenceError on click
            fnClickFunc(event);
        });

        $('#change-password').click(function () {
            app.loadWindow('loginWindow', 'passwordWindow');
        });

        $('#attack-shortcut').click(function () {
            game.makePlayerInteractNextTo();
        });

        $('.close').click(function () {
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

    game.onDisconnect(function (message) {
        $('#errorwindow')
            .find('p')
            .html(message + '<em>Disconnected. Please reload the page.</em>');
        $('#errorwindow').show();
        $('#errorwindow').focus();
    });

    game.onClientError(function (message) {
        $('#errorwindow').find('p').html(message);
        $('#errorwindow').show();
        $('#errorwindow').focus();
    });

    game.onPlayerDeath(function () {
        game.player.dead();
        $('#diedwindow').show();
        $('#diedwindow').focus();
    });

    game.onNotification(function (message) {
        app.showMessage(message);
    });

    app.initHealthBar();
    app.initExpBar();
    app.initPlayerBar();

    $('#nameinput').attr('value', '');
    $('#pwinput').attr('value', '');
    $('#pwinput2').attr('value', '');
    $('#emailinput').attr('value', '');
    $('#chatbox').attr('value', '');

    const fnClickFunc = function (e) {
        app.center();
        app.setMouseCoordinates(e.data.global.x, e.data.global.y);
        // FIX: typo'd property name (`auctioSellDialogPopuped`) never matched app.js's `auctionsellDialogPopuped`, so this check was always true and never blocked clicks while the auction-sell dialog was open
        if (game && !app.dropDialogPopuped && !app.auctionsellDialogPopuped) {
            if (!game.usejoystick) game.click();
        }
        app.hideWindows();
        event.stopPropagation();
    };

    $(document).ready(function () {
        $('#gui').on('click', function (event) {
            //event.preventDefault();
        });
        game.inventoryDialog.loadInventoryEvents();
    });
    $('#respawn').click(function (event) {
        game.audioManager.playSound('revive');
        game.respawnPlayer();
        $('#diedwindow').hide();
    });

    installMainUI();

    installMainInput();

    installMainDialogs();

    if (game.tablet) {
        $('body').addClass('tablet');
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

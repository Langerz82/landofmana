// Converted from AMD (define) + Class.extend to a native ES6 module/class.
// NOTE: 'lib/localforage.js' is a UMD/browserify bundle (checks for CommonJS `module.exports`,
// then AMD `define.amd`, then falls back to `window.localforage = ...`). It has no ES `export`
// of its own, so it can't be given a named/default binding - but since neither `module`/`exports`
// nor a RequireJS-style `define` exist in this native-ES-module setup, importing it purely for
// its side effect still correctly falls through to the `window.localforage` branch, exactly as
// it did as a classic <script> tag. This is the earliest point in the import graph
// (main.js imports App before Game), so it's imported here once rather than in every consumer.
/* global Mob, Item, Types, Utils, log, _, TRANSITIONEND, Class, localforage, lang */
import Detect from '../detect.js';
import Mob from '../entity/mob.js';
import Item from '../entity/item.js';
import MobData from '../data/mobdata.js';
import User, { PlayerSummary } from '../user.js';
import UserClient from '../userclient/userclient.js';
import config from '../config.js';
import PlayerAnim from '../playeranim.js';
import '../lib/localforage.js';

// App's own behavior is split across these mixin modules for readability (app.js had
// grown to ~930 lines). Each install* call below merges plain-function methods onto
// App.prototype; they're not subclasses/separate instances, just App's own methods living
// in separate files.
import { installAppValidation } from './appvalidation.js';
import { installAppUI } from './appui.js';

export default class App {
    constructor() {
        window.app = this; // FIX (conversion): was a bare `app = this` assignment; this is the canonical declaration site for the cross-file `app` global, made explicit for ES module strict mode (see js/globalstate.js for the same pattern applied to other legacy shared globals)

        this.currentPage = 1;
        this.blinkInterval = null;
        this.ready = false;

        // Cached here (previously a separate initFormFields() method, called both from here
        // and from every appui.js loadWindow() call even though these are static form fields
        // that never change after the DOM is ready) - moved directly into the constructor and
        // set once. Must run before this.loadWindow(...) below, which uses jqAboutButton/
        // jqUserRemove.
        this.jqUserLoad = $('#user_load');
        this.jqUserCreate = $('#user_create');
        this.jqPlayerCancel = $('#player_cancel');
        this.jqUserRemove = $('#user_remove');
        this.jqAboutButton = $('#aboutbutton');
        this.jqRemovePassword = $('#remove_password');
        this.jqUserSave = $('#user_save');

        // Login form fields
        this.jqUsernameInput = $('#user_name');
        this.jqUserPasswordInput = $('#user_password');
        this.jqUserHashInput = $('#user_hash');
        this.userFormFields = [this.jqUsernameInput, this.jqUserPasswordInput];

        // Create new character form fields
        this.jqPlayerNameInput = $('#player_name');
        this.playerFormFields = [this.jqPlayerNameInput];

        this.dropDialogPopuped = false;
        this.auctionsellDialogPopuped = false;

        this.inventoryNumber = 0;

        this.userReady = false;

        this.classNames = ['user_window', 'player_window'];
        this.loadWindow(this.classNames[1], this.classNames[0]);

        // Hoisted above the localforage callbacks below (was previously declared further
        // down, just before the first place it was needed) so those callbacks - which are
        // plain (non-arrow) functions and don't have their own bound `this` - can close over
        // `self` to reuse the already-cached form-field lookups instead of re-querying.
        const self = this;

        localforage.getItem('user_hash', function (e, val) {
            log.info('val=' + val);
            // FIX: .value is a no-op on a jQuery object; use .val() to actually set the field
            self.jqUserHashInput.val(val);
        });
        localforage.getItem('user_name', function (e, val) {
            log.info('val=' + val);
            // FIX: .value is a no-op on a jQuery object; use .val() to actually set the field
            self.jqUsernameInput.val(val);
        });
        // FIX: .value is a no-op on a jQuery object; use .val() to actually set the field
        this.jqUserPasswordInput.val('');

        // FIX: menucolor/buttoncolor were only ever read from localforage and applied
        // inside SettingsHandler's constructor (settingshandler.js), which isn't created
        // until game.run() - i.e. after the player logs in/is created. The login and
        // character-select screens (#user_window/#player_window, both already in the DOM
        // at this point) use the same --pixel-bg CSS var and .frame-new-button background
        // as the in-game UI, so they were stuck showing the default colors instead of the
        // player's saved choice until after login. Applied here too, at App construction
        // (i.e. as soon as the document is ready - see main.js's $(document).ready that
        // creates App), so the login screen picks up the saved colors immediately.
        // SettingsHandler.apply()/constructor still re-applies these once the game starts
        // (harmless - same value) and remains the place the color-picker inputs' change
        // handlers get bound.
        localforage.getItem('menucolor', function (e, val) {
            if (!val) return;
            self.jqRoot.css('--pixel-bg', val);
            self.jqButtonMenuColor.val(val);
        });
        localforage.getItem('buttoncolor', function (e, val) {
            if (!val) return;
            self.jqFrameNewButton.css('background-color', val);
            self.jqButtonButtonColor.val(val);
        });

        // NOTE: previously wrapped in its own `$(document).ready(function () {...})`, but
        // App is only ever constructed from inside main.js's own `$(document).ready(...)`
        // (the only `new App()` call site in the codebase) - by the time this constructor
        // runs, the DOM is already guaranteed ready, so that inner wrapper only ever fired
        // synchronously anyway. Flattened out so these are direct constructor-level
        // assignments instead of being nested inside a callback.
        this.jqUserWindow = $('#user_window');
        this.jqPlayerWindow = $('#player_window');

        this.jqPlayerSelect = $('#player_select');
        this.jqPlayerLoad = $('#player_load');
        this.jqPlayerCreate = $('#player_create');
        this.jqPlayerCreateForm = $('#player_create_form');
        this.jqLblPlayerSelect = $('#lbl_player_select');

        // Cached here for appui.js's showChat/showChatLog/hideChatLog/showDropDialog/
        // hideDropDialog/showAuctionSellDialog/hideAuctionSellDialog (mixed onto
        // App.prototype via installAppUI, so `this` there is this same App instance) -
        // those previously re-queried these on every call instead of reusing a cached lookup.
        this.jqChatbox = $('#chatbox');
        this.jqChatInput = $('#chatinput');
        this.jqChatButton = $('#chatbutton');
        this.jqChatLog = $('#chatLog');
        this.jqDropDialog = $('#dropDialog');
        this.jqAuctionSellDialog = $('#auctionSellDialog');

        this.jqLoginInfo = $('#loginInfo');
        this.jqGameHeading = $('#gameheading');

        // Cached here for appui.js's initTargetHud/initExpBar/initHealthBar/blinkHealthBar/
        // initMenuButton/initCombatBar/npcDialoguePic/hideIntro/showDropDialog/
        // showAuctionSellDialog and appvalidation.js's addValidationError (mixed onto
        // App.prototype via installAppUI/installAppValidation) - those methods run repeatedly
        // over the app's lifetime (e.g. initTargetHud/initExpBar/initHealthBar via
        // resizeUi(), npcDialoguePic per dialogue line, showDropDialog/showAuctionSellDialog
        // per dialog open) and previously re-queried these static elements fresh on every
        // call instead of reusing a single lookup made once here.
        this.jqTarget = $('#target');
        this.jqTargetName = $('#target .name');
        this.jqTargetHealth = $('#target-health');
        this.jqTargetHealthText = $('#target-healthtext');
        this.jqTargetHealthChild = $('#target .health');
        this.jqCombatContainer = $('#combatContainer');
        this.jqExp = $('#exp');
        this.jqExpBar = $('#expbar');
        this.jqExpLevel = $('#explevel');
        this.jqStatBars = $('#statbars');
        this.jqHealth = $('#health');
        this.jqHealthText = $('#healthtext');
        this.jqMenuContainer = $('#menucontainer');
        this.jqCharacterMenu = $('#charactermenu');
        this.jqNpcDialoguePic = $('#npcDialoguePic');
        this.jqBody = $('body');
        this.jqDropCount = $('#dropCount');
        this.jqAuctionSellCount = $('#auctionSellCount');
        this.jqValidationSummary = $('.validation-summary');
        // Used by the localforage 'menucolor'/'buttoncolor' callbacks above - those callbacks
        // fire asynchronously (after this constructor has already finished running), so
        // computing these here instead of inside the callbacks doesn't change behavior, it
        // just avoids nesting the selector lookups inside a callback closure.
        this.jqRoot = $(':root');
        this.jqButtonMenuColor = $('#buttonmenucolor');
        this.jqFrameNewButton = $('div.frame-new-button');
        this.jqButtonButtonColor = $('#buttonbuttoncolor');

        const jqErrorRefresh = $('#error_refresh');
        jqErrorRefresh.click(function (event) {
            location.reload();
        });

        const jqCmdQuit = $('#cmdQuit');
        jqCmdQuit.click(function (event) {
            navigator.app.exitApp();
        });

        const jqRemoveWindow = $('#remove_window');
        const jqRemoveConfirm = $('#remove_confirm');

        this.jqUserRemove.click(function (event) {
            jqRemoveWindow.show();
        });
        const jqUserClose = $('#user_close');
        jqUserClose.click(function (event) {
            jqRemoveWindow.hide();
        });

        const jqUserRemoveConfirm = $('#user_remove_confirm');
        jqUserRemoveConfirm.click(function (event) {
            const rpawd = jqRemoveConfirm.val();
            if (rpawd === 'YES') {
                if (confirm('DANGER - Remove your account PERMANENTLY?')) {
                    if (
                        confirm(
                            'DANGER - Are you really sure to remove your account FOREVER?'
                        )
                    ) {
                        app.tryUserAction(3);
                    }
                }
                jqRemoveWindow.hide();
            }
        });

        self.jqPlayerWindow.ready(function () {
            self.jqPlayerCreateForm.hide();
            self.jqPlayerLoad.hide();
            self.jqPlayerCreate.show();
        });

        self.jqPlayerSelect.change(function () {
            if ($(this).val() === -1) {
                self.jqPlayerLoad.hide();
                self.jqPlayerCreate.show();
                self.jqPlayerCreateForm.show();
            } else {
                self.jqPlayerLoad.show();
                self.jqPlayerCreateForm.hide();
            }
        });

        self.jqPlayerCreate.click(function () {
            if (self.jqPlayerLoad.hasClass('loading')) return;

            if (self.jqPlayerCreate.hasClass('loading')) return;

            if (self.jqPlayerCreateForm.is(':visible')) self.tryPlayerAction(4);

            if (self.jqPlayerNameInput.val() === '') {
                app.showPlayerCreate();
                self.jqPlayerNameInput.focus();
            }
        });

        // TODO - revise below.
        this.info_callback = function (data) {
            switch (data[0]) {
                case 'timeout':
                    self.addValidationError(null, lang.data['TIMEOUT_CONNECT']);
                    break;

                case 'invalidlogin':
                    {
                        // FIX: server now tracks failed-password attempts (User.checkUser in
                        // userserver/js/user.js) and sends how many attempts remain as data[1]
                        // (configurable via MainConfig.max_password_attempts, default 3),
                        // closing the connection only once exhausted, instead of the old fixed
                        // (and inconsistently-off-by-one) threshold. data[1] is only present for
                        // a wrong-password hit against a real account - the "username doesn't
                        // exist at all" case (redis.js loadUser) reuses this same "invalidlogin"
                        // code deliberately, with no count, to avoid revealing whether the
                        // username exists.
                        const triesRemaining = data[1];
                        if (typeof triesRemaining !== 'number') {
                            self.addValidationError(null, lang.data['LOGIN_INVALID']);
                        } else if (triesRemaining > 0) {
                            self.addValidationError(
                                null,
                                lang.data['LOGIN_INVALID_TRIES'].format([
                                    triesRemaining,
                                    triesRemaining === 1 ? '' : 's'
                                ])
                            );
                        } else {
                            // FIX: the connection is actually closed at this point (server-side
                            // lockout after MainConfig.max_password_attempts), but the shown
                            // message was identical to the plain "incorrect" case above/below -
                            // nothing told the player they'd been disconnected rather than just
                            // getting the password wrong again. Say so explicitly.
                            self.jqLoginInfo.text('Disconnected.');
                            self.addValidationError(null, lang.data['LOGIN_LOCKED_OUT']);
                            // FIX: the server sends this UC_ERROR and closes the socket right
                            // after (see userserver/js/user.js's checkUser) - the actual socket
                            // 'disconnect' event fires moments later with only a generic
                            // transport-level reason ('transport close' etc, see userclient.js's
                            // disconnect handler), which would otherwise overwrite this specific
                            // message with something far less useful. Stash it on the UserClient
                            // instance so that handler can show the real reason instead.
                            self.userclient.disconnectReason =
                                lang.data['LOGIN_LOCKED_OUT'];
                        }
                        // FIX: clear this error (whether retryable or the disconnected message
                        // above) as soon as the player edits either field, instead of leaving a
                        // stale "incorrect"/"disconnected" message up after they've already
                        // started fixing their input.
                        self.clearErrorOnFieldsChange(self.userFormFields);
                    }
                    break;

                case 'userexists':
                    {
                        // FIX: server (userserver/js/redis.js DatabaseHandler.createUser) no
                        // longer disconnects on the first "username taken" hit - it now allows a
                        // configurable number of retries (MainConfig.max_username_attempts,
                        // default 5) before closing, and sends how many attempts remain as
                        // data[1]. Only show "Disconnected." once the connection was actually
                        // closed (triesRemaining === 0); otherwise tell the player how many
                        // attempts they have left and let them retry with a different name.
                        const triesRemaining = data[1];
                        if (triesRemaining > 0) {
                            self.addValidationError(
                                self.jqUsernameInput,
                                lang.data['USERNAME_TAKEN_TRIES'].format([
                                    triesRemaining,
                                    triesRemaining === 1 ? '' : 's'
                                ])
                            );
                        } else {
                            // FIX: the connection is actually closed at this point (server-side
                            // lockout after MainConfig.max_username_attempts), but the shown
                            // message was identical to the plain "not available" retry case
                            // above - nothing told the player they'd been disconnected rather
                            // than just needing to pick another name. Say so explicitly.
                            self.jqLoginInfo.text('Disconnected.');
                            self.addValidationError(null, lang.data['USERNAME_LOCKED_OUT']);
                            // FIX: same reasoning as the invalidlogin lockout branch above -
                            // stash so the real reason survives into the disconnect window
                            // instead of being overwritten by a generic transport-level message.
                            self.userclient.disconnectReason =
                                lang.data['USERNAME_LOCKED_OUT'];
                        }
                        // FIX: clear this error (whether retryable or the disconnected message
                        // above) as soon as the player edits either field, instead of leaving a
                        // stale "not available"/"disconnected" message up after they've already
                        // started changing their input.
                        self.clearErrorOnFieldsChange(self.userFormFields);
                    }
                    break;

                case 'playerexists':
                // FIX: tryPlayerAction() adds the "loading" class to jqPlayerLoad/
                // jqPlayerCreate before sending the create/login request (used to block
                // double-submits while a request is in flight), but nothing ever removed
                // it again for the player-create/-load buttons specifically (unlike
                // onUserReady(), which does this for the user-level buttons). Since the
                // server doesn't close the connection for this error (it's meant to be
                // retryable - just pick another name), the buttons were staying permanently
                // disabled after the first failed attempt, silently swallowing every retry
                // via the "hasClass('loading') return;" guards in the click handlers.
                //
                // Kept disabled on purpose until the player actually edits the name field
                // to something different (resubmitting the exact same taken name should
                // still no-op rather than silently retry).
                case 'invalidname':
                    // FIX: server (userserver/js/user.js handleCreatePlayer) sends
                    // "invalidname" for a rejected player name, not "invalidusername" - that
                    // code is only ever sent for the separate user-account flow. This case
                    // never matched anything before, so a bad player name fell through to
                    // the generic `default` branch (confusing message) and had the same
                    // stuck-button bug as 'playerexists' above.
                    self.addValidationError(
                        self.jqPlayerNameInput,
                        data[0] === 'playerexists'
                            ? lang.data['PLAYERNAME_TAKEN']
                            : lang.data['PLAYERNAME_ALPHANUMERIC']
                    );

                    // FIX: also re-enables the Create/Load buttons (see the "loading" class
                    // comment above) once the name is actually edited - clearErrorOnFieldsChange
                    // uses `input` rather than `keypress` specifically so this isn't reliant
                    // on key events, which mobile virtual keyboards (autocomplete/predictive-
                    // text taps, swipe typing, IME-driven soft keyboards) don't always fire.
                    self.clearErrorOnFieldsChange(
                        [self.jqPlayerNameInput],
                        function () {
                            self.jqPlayerLoad.removeClass('loading');
                            self.jqPlayerCreate.removeClass('loading');
                        }
                    );
                    break;

                case 'invalidusername':
                    // The username contains characters that are not allowed (rejected by the sanitizer)
                    self.addValidationError(null, lang.data['USERNAME_INVALID_CHARS']);
                    break;

                case 'loggedin':
                    // Attempted to log in with the same user multiple times simultaneously.
                    // Server closes the connection right after sending this (see
                    // userserver/js/user.js's handleLoginPlayer) - stash the reason (see the
                    // invalidlogin/userexists lockout branches above for the full rationale)
                    // so the disconnect window shows it instead of a generic message.
                    self.addValidationError(null, lang.data['USER_ALREADY_LOGGEDIN']);
                    self.userclient.disconnectReason =
                        lang.data['USER_ALREADY_LOGGEDIN'];
                    break;

                case 'ban':
                    // Server closes the connection right after sending this (see
                    // userserver/js/user.js's checkUser) - stash the reason.
                    self.addValidationError(null, lang.data['USER_BANNED']);
                    self.userclient.disconnectReason = lang.data['USER_BANNED'];
                    break;

                case 'full':
                    self.addValidationError(null, lang.data['SERVERS_FULL']);
                    self.userclient.disconnectReason = lang.data['SERVERS_FULL'];
                    break;

                case 'noserver':
                    // Server closes the connection right after sending this (see
                    // userserver/js/main.js's handleConnectUser) - stash the reason.
                    self.jqLoginInfo.text('Disconnected.');
                    self.addValidationError(null, lang.data['NOSERVER']);
                    self.userclient.disconnectReason = lang.data['NOSERVER'];
                    break;

                default:
                    // FIX: `result` was not in scope here (would throw ReferenceError); use `data[0]`, the switch's own subject
                    self.addValidationError(
                        null,
                        lang.data['LAUNCH_FAILED'].format([
                            data[0] ? data[0] : lang.data['REASON_UNKNOWN']
                        ])
                    );
                    break;
            }
        };

        this.start();
        this.connect();
    }

    connect() {
        config.waitForConfig(this.userClient.bind(this));
    }

    userClient() {
        const self = this;
        this.userclient = new UserClient(config.build, this.useServer);

        this.userclient.fail_callback = function (reason) {
            // FIX: info_callback's switch reads `data[0]` (see its cases just
            // above - 'timeout'/'invalidlogin'/etc are all string tags read
            // from data[0]); passing a plain {success, reason} object here
            // meant data[0] was always undefined, so this always fell through
            // to the generic "(reason unknown)" default-branch message
            // regardless of what `reason` actually said. This was also never
            // actually called from anywhere until userclient.js's
            // connect_error/error/disconnect handlers were wired up to invoke
            // it - pass the shape info_callback actually expects now that it
            // is.
            self.info_callback([reason]);
            self.started = false;
        };
    }

    setGame(game) {
        // FIX (dead code): removed `game.client = game.client;` - a no-op self-assignment,
        // likely a leftover from a refactor where this was meant to assign `this.client`
        // (App doesn't currently have/use a `.client` property, so left out rather than
        // guessing that was the intent).

        this.isMobile = game.renderer.mobile;
        this.isTablet = game.renderer.tablet;
        this.isDesktop = !(this.isMobile || this.isTablet);
        this.supportsWorkers = !!window.Worker;
        this.ready = true;

        this.initMenuButton();
        this.initCombatBar();
    }

    startGame(server, ps) {
        this.jqGameHeading.css('display', 'none');

        if (game.started) return;

        log.debug('Starting game with build config.');

        game.useServer = server;

        this.center();

        game.run(server, ps);
        game.start();
    }

    start() {
        const self = this;
        this.jqUserLoad.click(function () {
            if (self.jqUserLoad.hasClass('loading')) return;
            self.tryUserAction(1);
        });
        this.jqUserCreate.click(function () {
            if (self.jqUserCreate.hasClass('loading')) return;
            self.tryUserAction(2);
        });
        this.jqPlayerLoad.click(function () {
            if (self.jqPlayerLoad.hasClass('loading')) return;
            if (self.jqPlayerCreate.hasClass('loading')) return;

            self.tryPlayerAction(3);
        });
        this.jqPlayerCancel.click(function () {
            if (self.jqPlayerLoad.is(':visible'))
                self.loadWindow('player_window', 'user_window');
            else {
                self.showPlayerLoad();
            }
        });
    }
}

installAppValidation(App.prototype);
installAppUI(App.prototype);

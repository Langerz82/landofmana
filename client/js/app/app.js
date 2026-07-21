// Converted from AMD (define) + Class.extend to a native ES6 module/class.
// NOTE: 'lib/localforage.js' is a UMD/browserify bundle (checks for CommonJS `module.exports`,
// then AMD `define.amd`, then falls back to `window.localforage = ...`). It has no ES `export`
// of its own, so it can't be given a named/default binding - but since neither `module`/`exports`
// nor a RequireJS-style `define` exist in this native-ES-module setup, importing it purely for
// its side effect still correctly falls through to the `window.localforage` branch, exactly as
// it did as a classic <script> tag. This is the earliest point in the import graph
// (main.js imports App before Game), so it's imported here once rather than in every consumer.
/* global Mob, Item, Types, Utils, log, _, TRANSITIONEND, Class, localforage */
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

            this.initFormFields();
            this.dropDialogPopuped = false;
            this.auctionsellDialogPopuped = false;

            this.inventoryNumber = 0;

            this.userReady = false;

            this.classNames = ["user_window",
            	"player_window"];
            this.loadWindow(this.classNames[1],this.classNames[0]);

      		   localforage.getItem('user_hash', function(e, val) {
      		   	   log.info("val="+val);
      			     // FIX: .value is a no-op on a jQuery object; use .val() to actually set the field
      			     $('#user_hash').val(val);
      		   });
      		   localforage.getItem('user_name', function(e, val) {
      		   	   log.info("val="+val);
      			     // FIX: .value is a no-op on a jQuery object; use .val() to actually set the field
      			     $('#user_name').val(val);
      		   });
      		   // FIX: .value is a no-op on a jQuery object; use .val() to actually set the field
      		   $('#user_password').val("");

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
      		   localforage.getItem('menucolor', function(e, val) {
      		   	   if (!val) return;
      			     $(':root').css('--pixel-bg', val);
      			     $('#buttonmenucolor').val(val);
      		   });
      		   localforage.getItem('buttoncolor', function(e, val) {
      		   	   if (!val) return;
      			     $('div.frame-new-button').css('background-color', val);
      			     $('#buttonbuttoncolor').val(val);
      		   });

		        const self = this;

            $( document ).ready(function() {
              self.jqUserWindow = $('#user_window');
              self.jqPlayerWindow = $('#player_window');

              self.jqPlayerSelect = $("#player_select");
              self.jqPlayerLoad = $("#player_load");
              self.jqPlayerCreate = $("#player_create");
              self.jqPlayerCreateForm = $('#player_create_form');
      			});

            this.$loginInfo = $('#loginInfo');

            $('#error_refresh').click(function(event){
            		location.reload();
            });

            $('#cmdQuit').click(function(event){
            		navigator.app.exitApp();
            });

            $('#user_remove').click(function (event) {
              $('#remove_window').show();
            });
            $('#user_close').click(function (event) {
              $('#remove_window').hide();
            });

            $('#user_remove_confirm').click(function (event) {
              const rpawd = $('#remove_confirm').val();
              if (rpawd === "YES")
              {
                if(confirm("DANGER - Remove your account PERMANENTLY?")) {
                  if (confirm("DANGER - Are you really sure to remove your account FOREVER?")) {
                    app.tryUserAction(3);
                  }
                }
                $('#remove_window').hide();
              }
            });

            $('#player_window').ready(function () {
              self.jqPlayerCreateForm.hide();
              self.jqPlayerLoad.hide();
              self.jqPlayerCreate.show();
            });

            $('#player_select').change(function () {
              if ($(this).val() === -1)
              {
                self.jqPlayerLoad.hide();
                self.jqPlayerCreate.show();
                self.jqPlayerCreateForm.show();
              }
              else
              {
                self.jqPlayerLoad.show();
                self.jqPlayerCreateForm.hide();
              }
            });

            $('#player_create').click(function () {
              if (self.jqPlayerLoad.hasClass("loading"))
                return;

              if (self.jqPlayerCreate.hasClass("loading"))
                return;

              if (self.jqPlayerCreateForm.is(":visible"))
                self.tryPlayerAction(4);

              if ($('#player_name').val() === "")
              {
                app.showPlayerCreate();
                $('#player_name').focus();
              }
            });

// TODO - revise below.
            this.info_callback = function(data) {
              switch(data[0]) {
                  case "timeout":
                      self.addValidationError(null, "Timeout whilst attempting to establish connection to RSO servers.");
                  break;

                  case 'invalidlogin': {
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
                      if (typeof triesRemaining !== "number") {
                          self.addValidationError(null, 'The username or password you entered is incorrect.');
                      } else if (triesRemaining > 0) {
                          self.addValidationError(null,
                              'The username or password you entered is incorrect. ' + triesRemaining +
                              ' attempt' + (triesRemaining === 1 ? '' : 's') + ' remaining.');
                      } else {
                          // FIX: the connection is actually closed at this point (server-side
                          // lockout after MainConfig.max_password_attempts), but the shown
                          // message was identical to the plain "incorrect" case above/below -
                          // nothing told the player they'd been disconnected rather than just
                          // getting the password wrong again. Say so explicitly.
                          self.$loginInfo.text("Disconnected.");
                          self.addValidationError(null, 'You have been disconnected: too many incorrect login attempts.');
                      }
                      // FIX: clear this error (whether retryable or the disconnected message
                      // above) as soon as the player edits either field, instead of leaving a
                      // stale "incorrect"/"disconnected" message up after they've already
                      // started fixing their input.
                      self.clearErrorOnFieldsChange(self.userFormFields);
                  }
                  break;

                  case 'userexists': {
                      // FIX: server (userserver/js/redis.js DatabaseHandler.createUser) no
                      // longer disconnects on the first "username taken" hit - it now allows a
                      // configurable number of retries (MainConfig.max_username_attempts,
                      // default 5) before closing, and sends how many attempts remain as
                      // data[1]. Only show "Disconnected." once the connection was actually
                      // closed (triesRemaining === 0); otherwise tell the player how many
                      // attempts they have left and let them retry with a different name.
                      const triesRemaining = data[1];
                      if (triesRemaining > 0) {
                          self.addValidationError(self.$usernameinput,
                              'The username you entered is not available. ' + triesRemaining +
                              ' attempt' + (triesRemaining === 1 ? '' : 's') + ' remaining.');
                      } else {
                          // FIX: the connection is actually closed at this point (server-side
                          // lockout after MainConfig.max_username_attempts), but the shown
                          // message was identical to the plain "not available" retry case
                          // above - nothing told the player they'd been disconnected rather
                          // than just needing to pick another name. Say so explicitly.
                          self.$loginInfo.text("Disconnected.");
                          self.addValidationError(null, 'You have been disconnected: too many attempts with an unavailable username.');
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
                      self.addValidationError(self.$playernameinput,
                          data[0] === 'playerexists' ?
                              'The playername you entered is not available.' :
                              'Please enter player name alpha numeric characters only.');

                      // FIX: also re-enables the Create/Load buttons (see the "loading" class
                      // comment above) once the name is actually edited - clearErrorOnFieldsChange
                      // uses `input` rather than `keypress` specifically so this isn't reliant
                      // on key events, which mobile virtual keyboards (autocomplete/predictive-
                      // text taps, swipe typing, IME-driven soft keyboards) don't always fire.
                      self.clearErrorOnFieldsChange([self.$playernameinput], function() {
                          self.jqPlayerLoad.removeClass("loading");
                          self.jqPlayerCreate.removeClass("loading");
                      });
                  break;

                  case 'invalidusername':
                      // The username contains characters that are not allowed (rejected by the sanitizer)
                      self.addValidationError(null, 'The username you entered contains invalid characters.');
                  break;

                  case 'loggedin':
                      // Attempted to log in with the same user multiple times simultaneously
                      self.addValidationError(null, 'A player with the specified username is already logged in.');
                  break;

                  case 'ban':
                      self.addValidationError(null, 'You have been banned.');
                  break;

                  case 'full':
                      self.addValidationError(null, "All RRO2 gameservers are currently full.")
                  break;

                  default:
                      // FIX: `result` was not in scope here (would throw ReferenceError); use `data[0]`, the switch's own subject
                      self.addValidationError(null, 'Failed to launch the game: ' + (data[0] ? data[0] : '(reason unknown)'));
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

        this.userclient.fail_callback = function(reason){
            self.info_callback({
                success: false,
                reason: reason
            });
            self.started = false;
        };
      }


        setGame(game) {
            game.client = game.client;

            this.isMobile = game.renderer.mobile;
            this.isTablet = game.renderer.tablet;
            this.isDesktop = !(this.isMobile || this.isTablet);
            this.supportsWorkers = !!window.Worker;
            this.ready = true;

            this.initMenuButton();
            this.initCombatBar();
        }


        initFormFields() {
            this.getLoadUserButton = function() { return $('#user_load'); };
            this.getCreateUserButton = function() { return $('#user_create'); };
            this.getLoadPlayerButton = function() { return $('#player_load'); };
            this.getCreatePlayerButton = function() { return $('#player_create'); };
            this.getBackButton = function() { return $('#player_cancel'); };


            // Login form fields
            this.$usernameinput = $('#user_name');
            this.$userpasswordinput = $('#user_password');
            this.userFormFields = [this.$usernameinput, this.$userpasswordinput];


            // Create new character form fields
            this.$playernameinput = $('#player_name');
            this.playerFormFields = [this.$playernameinput];

        }


        startGame(server, ps) {
            $('#gameheading').css('display','none');

            if (game.started)
              return;

            log.debug("Starting game with build config.");

            game.useServer = server;

            this.center();

            game.run(server, ps);
            game.start();
        }


        start() {
            const self = this;
            this.getLoadUserButton().click(function () {
              if ($("#user_load").hasClass("loading"))
                return;
              self.tryUserAction(1);
            });
            this.getCreateUserButton().click(function () {
              if ($("#user_create").hasClass("loading"))
                return;
              self.tryUserAction(2);
            });
            this.getLoadPlayerButton().click(function () {
              if (self.jqPlayerLoad.hasClass("loading"))
                return;
              if (self.jqPlayerCreate.hasClass("loading"))
                return;

              self.tryPlayerAction(3);
            });
            this.getBackButton().click(function () {
              if (self.jqPlayerLoad.is(":visible"))
                self.loadWindow('player_window', 'user_window');
              else {
                self.showPlayerLoad();
              }
            })
        }

}

installAppValidation(App.prototype);
installAppUI(App.prototype);

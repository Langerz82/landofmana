// Mixin extracted from app.js: Login/character-create form validation: tryUserAction/tryPlayerAction, field-level validators, error display/clearing.
// Applied onto App.prototype via install*(...) call in app.js; not a standalone class.
import User, { PlayerSummary } from '../user.js';
/* global log */

export function installAppValidation(proto) {
    proto.tryUserAction = function (action) {
        if (this.starting) return; // Already loading

        if (action > 0) {
            const username = this.$usernameinput.val();
            const userpw =
                action === 3
                    ? $('#remove_password').val()
                    : this.$userpasswordinput.val();
            let hash = null;
            if (userpw === '') hash = $('#user_hash').val();
            log.info('hash=' + hash);

            if (!this.validateUserForm(username, userpw)) return;

            const user = (this.user = new User(
                this.userclient,
                username,
                userpw
            ));
            this.userclient.user = this.user;

            if ($('#user_save').is(':checked')) {
                localforage.setItem('user_name', username);
                localforage.setItem('user_hash', this.user.hash);
            }

            if (action === 1) this.userclient.sendLoginUser(this.user);
            if (action === 2) this.userclient.sendCreateUser(this.user);
            if (action === 3) this.userclient.sendRemoveUser(this.user);
        }
    };

    proto.tryPlayerAction = function (action) {
        if (this.starting) return; // Already loading

        if (action === 3 || action === 4) {
            this.jqPlayerLoad.addClass('loading');
            this.jqPlayerCreate.addClass('loading');

            const username = this.$playernameinput.val();
            const playerIndex = parseInt(this.jqPlayerSelect.val());
            if (action === 4 && !this.validatePlayerForm(username)) return;

            const server = parseInt($('#player_server').val());

            let ps = null;
            if (action === 3) {
                this.userclient.sendLoginPlayer(server, playerIndex);
                ps = this.user.playerSum[playerIndex];
            }
            if (action === 4) {
                this.userclient.sendCreatePlayer(server, username);
                // FIX: bare `user` referenced an undeclared identifier (ReferenceError under ES module strict mode); this.user is the User instance created in tryUserAction
                ps = new PlayerSummary(this.user.playerSum.length, {
                    name: username
                });
            }
            if (ps) this.startGame(server, ps);
        }
    };

    proto.userFormActive = function () {
        return this.jqUserWindow.is(':visible');
    };

    proto.playerFormActive = function () {
        return this.jqPlayerWindow.is(':visible');
    };

    /**
     * Performs some basic validation on the login / create new character forms (required fields are filled
     * out, passwords match, email looks valid). Assumes either the login or the create new character form
     * is currently active.
     */

    proto.validateUserForm = function (username, userpw) {
        this.clearValidationErrors();

        if (!username) {
            this.addValidationError(
                this.$usernameinput,
                'Please enter a username.'
            );
            return false;
        }
        // FIX: `&&` made this condition impossible to hit (length can't be both <2 and >16); use `||` so it actually rejects bad lengths
        if (username.length < 2 || username.length > 16) {
            this.addValidationError(
                this.$usernameinput,
                'Please enter a username between 2 and 16 characters.'
            );
            return false;
        }
        if (username === username.replace(/^[A-Za-z0-9]+$/, '')) {
            this.addValidationError(
                this.$usernameinput,
                'Please enter username alpha numeric characters only.'
            );
            return false;
        }

        if (userpw.length > 0) {
            // FIX: `&&` made this condition impossible to hit (length can't be both <6 and >32); use `||` so it actually rejects bad lengths
            if (userpw.length < 6 || userpw.length > 32) {
                this.addValidationError(
                    this.$userpasswordinput,
                    'Please enter a user password between 6 and 32 characters.'
                );
                return false;
            }
            if (
                userpw ===
                userpw.replace(
                    /^[A-Za-z0-9@!#\$\^%&*()+=\-\[\]\\\';\.\/\{\}\|\":<>\? ]+$/,
                    ''
                )
            ) {
                this.addValidationError(
                    this.$userpasswordinput,
                    'Please enter password alpha numeric, and special characters only.'
                );
                return false;
            }
        }
        return true;
    };

    proto.validatePlayerForm = function (playername) {
        this.clearValidationErrors();

        if (!playername) {
            this.addValidationError(
                this.$playernameinput,
                'Please enter a player name.'
            );
            return false;
        }
        // FIX: `&&` made this condition impossible to hit (length can't be both <2 and >16); use `||` so it actually rejects bad lengths
        if (playername.length < 2 || playername.length > 16) {
            this.addValidationError(
                this.$playernameinput,
                'Please enter a player name between 2 and 16 characters.'
            );
            return false;
        }
        if (playername === playername.replace(/^[A-Za-z0-9]+$/, '')) {
            this.addValidationError(
                this.$playernameinput,
                'Please enter player name alpha numeric characters only.'
            );
            return false;
        }

        return true;
    };

    proto.addValidationError = function (field, errorText) {
        $('.validation-summary').html('');
        $('<span/>', {
            class: 'validation-error blink',
            text: errorText
        }).appendTo('.validation-summary');

        if (field) {
            field.addClass('field-error').select();
            field.keypress(function (event) {
                field.removeClass('field-error');
                $('.validation-error').remove();
                $(this).unbind(event);
            });
        }
    };

    /**
     * Wires up a listener on each of `fields` so that once any of them is edited to a
     * different value than it currently holds, the active validation error (message +
     * field highlighting) is cleared.
     *
     * Uses the `input` event rather than `keypress` (which is what addValidationError's
     * own built-in clear-on-keypress above uses) - `keypress` doesn't fire reliably on
     * mobile virtual keyboards (autocomplete/predictive-text taps, swipe typing, and many
     * IME-driven soft keyboards commit text without dispatching key events at all), so an
     * error/disabled state tied to it could get stuck on mobile even after the player
     * changed the value. Compares against each field's value at call time rather than
     * clearing on the first event, so retyping the exact same (still-invalid) value
     * doesn't clear the error either.
     *
     * `extraCleanup`, if given, runs once alongside the built-in clearing (e.g.
     * re-enabling a disabled button tied to the same error).
     */
    proto.clearErrorOnFieldsChange = function (fields, extraCleanup) {
        const originalValues = fields.map(function (field) {
            return field.val();
        });

        const clear = function () {
            fields.forEach(function (field) {
                field.off('input.errorRetry');
                field.removeClass('field-error');
            });
            $('.validation-error').remove();
            if (extraCleanup) extraCleanup();
        };

        fields.forEach(function (field, i) {
            field.off('input.errorRetry').on('input.errorRetry', function () {
                if (field.val() !== originalValues[i]) clear();
            });
        });
    };

    proto.clearValidationErrors = function () {
        let fields;
        if (this.userFormActive()) fields = this.userFormFields;
        else if (this.playerFormActive()) fields = this.playerFormFields;

        if (fields) {
            fields.forEach((field) => {
                if (field.hasClass('field-error'))
                    field.removeClass('field-error');
            });
            $('.validation-error').remove();
        }
    };
}

// Mixin extracted from userclient.js: inbound message handlers (onPlayerSummary/onWorlds/
// onVersion/onSyncTime/onWorldReady/onError). Applied onto UserClient.prototype via
// installUserClientCallbacks(...) call in userclient.js; not a standalone class. Same split
// pattern used for gameclient/gameclient.js -> gameclient/gameclientcallbacks.js.
import config from '../config.js';

/* global Types, Utils, log */

export function installUserClientCallbacks(proto) {
    proto.onPlayerSummary = function (data) {
        const user = this.user;

        user.setPlayerSummary(data);

        const count = user.playerSum.length;
        for (let i = 0; i < count; ++i) {
            const ps = user.playerSum[i];
            const option = ps.name + ' Lv' + Types.getLevel(ps.exp);

            const o = new Option(option, i);
            this.jqPlayerSelect.append(o);
        }

        app.loadWindow('user_window', 'player_window');
        this.jqPlayerSelect.focus();

        if (count > 0) {
            // NOTE: this targets the specific <option> just appended above, so it can't
            // be hoisted to a constructor-cached selector - the value (and thus the
            // element it matches) changes on every call.
            const jqSelectedOption = this.jqPlayerSelect.find(
                'option[value="' + (count - 1) + '"]'
            );
            jqSelectedOption.attr('selected', true);
            app.showPlayerLoad();
        }

        if (count === 0) {
            app.showPlayerCreate();
        } else {
            this.jqPlayerCreateForm.hide();
        }
    };

    proto.onWorlds = function (data) {
        // FIX: world/server list entries were string-concatenated into <option> HTML
        // with no escaping and an unquoted value attribute, unlike every other
        // server-controlled string in this file (onError/onVersion already use
        // Utils.escapeHtml). Escaped all four fields, quoted the value attribute, and
        // closed the previously-unterminated </option tag.
        for (let i = 0; i < data.length; i += 4) {
            this.jqPlayerServer.append(
                '<option value="' +
                    Utils.escapeHtml(data[i]) +
                    '">' +
                    Utils.escapeHtml(data[i + 1]) +
                    ' ' +
                    Utils.escapeHtml(data[i + 2]) +
                    '/' +
                    Utils.escapeHtml(data[i + 3]) +
                    '</option>'
            );
        }
    };

    proto.onVersion = function (data) {
        this.versionChecked = true;
        const version = Number(data[0]);
        const hash = data[1];
        app.hashChallenge = hash;
        log.info('onVersion: hash=' + hash);

        const local_version = Number(config.build.version);
        log.info('config.build.version=' + local_version);
        if (version !== local_version) {
            this.jqContainer.addClass('error');
            let errmsg =
                'Please download the new version of Land Of Mana.<br/>';

            if (game.tablet || game.mobile) {
                errmsg +=
                    '<br/>For mobile see: <a href="' +
                    config.build.updatepage +
                    '" target="_self">UPDATE LINK</a> or search Google play for "Land of Mana".';
            } else {
                errmsg +=
                    '<br/>For most browsers press Ctrl+F5 to reload the game cache files.';
            }
            game.clienterror_callback(errmsg);
            if (game.tablet || game.mobile)
                window.location.replace(config.build.updatepage);
            return;
        }
        app.onUserReady();
    };

    proto.onSyncTime = function (data) {
        // FIX: called bare `setWorldTime` (undefined/ReferenceError) instead of `Utils.setWorldTime`, unlike the identical handler in gameclient.js
        Utils.setWorldTime(Number(data[0]), Number(data[1]));
    };

    proto.onWorldReady = function (data) {
        // FIX: this deliberately closes the login/lobby-server connection as
        // part of the normal handoff to the gameserver (the player is done
        // with the userserver at this point) - that's expected, not a
        // failure. userclient.js's 'disconnect' socket handler used to be
        // dead (see its own FIX comment), so this never showed anything; now
        // that it's wired up to actually report disconnects, it needs to be
        // told this one is intentional so it doesn't show a spurious
        // "connection lost" error during a completely normal transition.
        this.intentionalDisconnect = true;
        this.connection.disconnect();
        game.onWorldReady(data);
    };

    proto.onError = function (data) {
        const error = data[0];

        switch (error) {
            case 'full':
            case 'invalidlogin':
            case 'userexists':
            case 'playerexists':
            case 'loggedin':
            case 'invalidusername':
            case 'ban':
            case 'passwordChanged':
                app.info_callback(data);
                return;
            // FIX: removed duplicate unreachable 'timeout' case (referenced undefined `self`); merged its isTimeout logic here using `this`
            case 'timeout':
                app.info_callback(data);
                this.isTimeout = true;
                return;
        }
        this._onError(data);
    };
}

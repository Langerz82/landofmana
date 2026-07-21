// Converted from AMD (define) + Class.extend to a native ES6 module/class.
// NOTE: 'pako' and 'BISON' remain classic (non-module) <script> globals, same as in
// gameclient.js, so they are not imported here.
import GameClient from './gameclient/gameclient.js';
import SkillHandler from './skillhandler.js';
import Quest from './quest.js';
import config from './config.js';
import Achievement from './achievement.js';

/* global Types, Utils, log */
// FIX: 'log' was used throughout this file (log.info/log.error/log.debug) but missing from
// this eslint no-undef hint; added for consistency with gameclient.js's equivalent comment

export default class UserClient {
      constructor(config, useServer) {
        this.connection = null;
        this.config = config;

        this.handlers = {};
        this.handlers[Types.UserMessages.UC_WORLD_READY] = this.onWorldReady;

        this.handlers[Types.Messages.BI_SYNCTIME] = this.onSyncTime;
        this.handlers[Types.UserMessages.UC_ERROR] = this.onError;
        this.handlers[Types.UserMessages.UC_VERSION] = this.onVersion;

        this.handlers[Types.UserMessages.UC_PLAYER_SUM] = this.onPlayerSummary;
        this.handlers[Types.UserMessages.UC_WORLDS] = this.onWorlds;

        this.useBison = false;
        this.versionChecked = false;

        this.useServer = useServer;
        this.enable();

        this.connect();
      }

      enable() {
          this.isListening = true;
      }

      disable() {
          this.isListening = false;
      }

      connect() {
          // FIX (hygiene): removed the duplicate `var self = this;` (was declared twice)
          const self = this;
          // NOTE: whether this connects over ws vs wss depends entirely on
          // this.config.protocol, sourced from config/config_build.json at runtime;
          // that build config lives outside this client/js tree and isn't visible here,
          // so it should be confirmed separately that production builds set protocol to
          // a secure scheme (wss).
          const url = this.config.protocol + "://"+ this.config.host +":"+ this.config.port +"/";

          log.info("Trying to connect to server : "+url);
          app.$loginInfo.text("Connecting to RRO2 server...");

          self.connection = io(url, {
            forceNew: true,
            reconnection: false,
            timeout: 10000,
            // FIX (dead code): removed stale commented-out secure/transports/rejectUnauthorized/ca
            // options - rejectUnauthorized was already commented out (i.e. cert validation was
            // NOT being disabled, which is the safe state) and `ca: data` referenced an undefined
            // `data` variable; neither was doing anything
            transports: ['websocket'],
          });

          self.connection.on('connect', function() {
            log.info("Connected to server "+self.config.host+":"+self.config.port);
            self.onConnected();
          });

          self.connection.on('connect_error', function(e) {
            self._onError(["There has been an error connecting to RSO server try again soon."]);
            log.error(e, true);
          });

          self.onMessage = function(data) {
            // FIX: was console.warn'ing every inbound packet unconditionally, including
            // login/session data - use log.debug, which is already gated behind the log
            // level (see lib/log.js) so this is silent outside debug builds
            log.debug("recv: "+data);
						const fnProcessMessage = function (message) {

							if(self.isListening) {
		            if(self.useBison) {
		              data = BISON.decode(message);
		            } else {
		              data = JSON.parse(message);
		            }
                fnRecieveAction(data);
		          }
						};
           const fnRecieveAction = function (data) {
             // FIX: same unconditional logging issue as onMessage above - use log.debug
             log.debug("recv: "+data);
             if(data instanceof Array) {
               if(data[0] instanceof Array) {
                 // Multiple actions received
                 self.receiveActionBatch(data);
               } else {
                 // Only one action received
                 self.receiveAction(data);
               }
             }
           };
           const method = data[0];
	        if (method === '2')
	        {
            // NOTE: substr(1) strips only the single '2' method marker set above via data[0];
            // this matches gameclient.js's identical compressed-message handling, so it is
            // consistent with the app-level protocol (a single leading marker char), not a bug.
            const buffer = Utils._base64ToArrayBuffer(data.substr(1));
            try {
              const message = pako.inflate(buffer, {gzip: true, to: 'string'});
						  fnProcessMessage(message);
            } catch (err) {
              // FIX: was silently swallowed via console.log; surface via log.error so decode
              // failures are visible/gated the same way as other errors in this file
              log.error("Failed to decompress server message: " + err);
            }
	        }
	        else if (method === '1') {
	          const message = data.substr(1);
						fnProcessMessage(message);
	        }
          else {
            const message = data.split(",");
            fnRecieveAction(message);
          }
	      };

        self.connection.on('message', this.onMessage);

        self.connection.on('error', function(e) {
          self._onError(["There has been an error connecting to RSO server try again soon."]);
          log.error(e, true);
        });

        self.connection.on('disconnect', function() {
            log.debug("Connection closed");
            if(self.disconnected_callback) {
                if(self.isTimeout) {
                    self._onError(["You have been disconnected for being inactive for too long"]);
                } else {
                    self._onError(["The connection to RRO2 has been lost."]);
                }
            }
        });
      }

      receiveAction(data) {
          const action = data.shift();
          if(this.handlers[action] && _.isFunction(this.handlers[action])) {
              this.handlers[action].call(this, data);
          }
          else {
              log.error("Unknown action : " + action);
          }
      }

      receiveActionBatch(actions) {
          actions.forEach(action => this.receiveAction(action));
      }

      sendMessage(json) {
          let data;
          if(this.connection.connected === true) {
            // FIX: was console.warn'ing every outbound packet unconditionally, including
            // sendLoginUser's username/hash - use log.debug (gated, see lib/log.js)
            if(this.useBison) {
              data = BISON.encode(json);
              // PERF: useBison is hardcoded false (see constructor), so this
              // branch never runs today, but keep a working log line for it.
              log.debug("sent=" + JSON.stringify(json));
            } else {
              data = JSON.stringify(json);
              // PERF: this used to call JSON.stringify(json) a second time
              // just to build the log message -- on every single outbound
              // packet. Reuse the string already computed above instead of
              // serializing twice.
              log.debug("sent=" + data);
            }
          try {
              this.connection.send("1"+data);
          } catch (err) {
            // FIX: was silently swallowed via console.log; surface via log.error
            log.error("Failed to send message: " + err);
          }
        }
      }

      onConnected() {
        log.info("Starting client/server handshake");

        this.sendUserConnected();
      }

      onPlayerSummary(data) {
        const user = this.user;

        user.setPlayerSummary(data);

        const count = user.playerSum.length;
        for (let i=0; i < count; ++i)
        {
          const ps = user.playerSum[i];
          const option = ps.name + " Lv" + Types.getLevel(ps.exp);

          const o = new Option(option, i);
          $('#player_select').append(o);
        }

        app.loadWindow('user_window', 'player_window');
        $('#player_select').focus();

        if (count > 0) {
          $('#player_select option[value="'+(count-1)+'"]').attr("selected",true);
          app.showPlayerLoad();
        }

        if (count === 0)
        {
          app.showPlayerCreate();
        }
        else
        {
          $('#player_create_form').hide();
        }
      }

      onWorlds(data) {
        // FIX: world/server list entries were string-concatenated into <option> HTML
        // with no escaping and an unquoted value attribute, unlike every other
        // server-controlled string in this file (onError/onVersion already use
        // Utils.escapeHtml). Escaped all four fields, quoted the value attribute, and
        // closed the previously-unterminated </option tag.
        for (let i = 0; i < data.length; i += 4)
        {
          $("#player_server").append("<option value=\""+Utils.escapeHtml(data[i])+"\">"+
            Utils.escapeHtml(data[i+1])+" "+Utils.escapeHtml(data[i+2])+"/"+Utils.escapeHtml(data[i+3])+"</option>");
        }
      }

      _onError(data) {
          const message = data[0];
          $('#container').addClass('error');
          // FIX: XSS - server-supplied error message was inserted unescaped via .html(); escape before rendering
          $('#errorwindow .errordetails').html("<p>"+Utils.escapeHtml(message)+"</p>");
          app.loadWindow('loginwindow','errorwindow');
          $('#errorwindow').focus();
      }

      onVersion(data) {
        this.versionChecked = true;
        const version = Number(data[0]);
        const hash = data[1];
        app.hashChallenge = hash;
        log.info("onVersion: hash="+hash);

        const local_version = Number(config.build.version);
        log.info("config.build.version="+local_version);
        if (version !== local_version)
        {
          $('#container').addClass('error');
          let errmsg = "Please download the new version of Land Of Mana.<br/>";

          if (game.tablet || game.mobile) {
            errmsg += "<br/>For mobile see: <a href=\"" + config.build.updatepage +
              "\" target=\"_self\">UPDATE LINK</a> or search Google play for \"Land of Mana\".";
          } else {
            errmsg += "<br/>For most browsers press Ctrl+F5 to reload the game cache files.";
          }
          game.clienterror_callback(errmsg);
          if (game.tablet || game.mobile)
            window.location.replace(config.build.updatepage);
          return;
        }
        app.onUserReady();
      }

      onSyncTime(data) {
        // FIX: called bare `setWorldTime` (undefined/ReferenceError) instead of `Utils.setWorldTime`, unlike the identical handler in gameclient.js
        Utils.setWorldTime(Number(data[0]), Number(data[1]))
      }

      onWorldReady(data) {
        this.connection.disconnect();
        game.onWorldReady(data);
      }

      onError(data) {
        const error = data[0];

        switch(error) {
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
      }

      sendUserConnected() {
          this.sendMessage([Types.UserMessages.CU_CONNECT_USER]);
      }

      sendLoginUser(user) {
        this.sendMessage([Types.UserMessages.CU_LOGIN_USER,
                          user.username,
                          user.hash]);
      }

      sendCreateUser(user) {
        this.sendMessage([Types.UserMessages.CU_CREATE_USER,
                          user.username,
                          user.hash]);
      }

      sendRemoveUser(user) {
        this.sendMessage([Types.UserMessages.CU_REMOVE_USER,
                          user.username,
                          user.hash]);
      }

      sendLoginPlayer(worldIndex, playerIndex) {
        this.sendMessage([Types.UserMessages.CU_LOGIN_PLAYER,
                          worldIndex,
                          playerIndex]);
      }

      sendCreatePlayer(worldIndex, playerName) {
        this.sendMessage([Types.UserMessages.CU_CREATE_PLAYER,
          worldIndex,
          playerName]);
      }
}


define(['gameclient', 'skillhandler', 'quest', 'config', 'achievement'], function(GameClient, SkillHandler, Quest, config, Achievement) {
  var UserClient = Class.extend({
      init: function(config, useServer) {
        var self = this;

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
      },

      enable: function() {
          this.isListening = true;
      },

      disable: function() {
          this.isListening = false;
      },

      connect: function() {
          var self = this;
          var url = this.config.protocol + "://"+ this.config.host +":"+ this.config.port +"/";

          log.info("Trying to connect to server : "+url);
          app.$loginInfo.text("Connecting to RRO2 server...");

          var self = this;
          /*$.get('./rro2.pem', function(data) {
              //alert(data);
              certLoaded(self, data);
          });*/

          //var certLoaded = function(self, data) {
          self.connection = io(url, {
            forceNew: true,
            reconnection: false,
            timeout: 10000,
            //secure: true,
            //transports: ['websocket','polling'],
            transports: ['websocket'],
            //rejectUnauthorized: false,
            //ca: data
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
            console.warn("recv: "+data);
						var fnProcessMessage = function (message) {

							if(self.isListening) {
		            if(self.useBison) {
		              data = BISON.decode(message);
		            } else {
		              data = JSON.parse(message);
		            }
                fnRecieveAction(data);
		          }
						};
           var fnRecieveAction = function (data) {
             console.warn("recv: "+data);
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
           var method = data.substr(0,2) ;
	        if (method === '2[')
	        {
            var buffer = _base64ToArrayBuffer(data.substr(1));
            try {
              var message = pako.inflate(buffer, {gzip: true, to: 'string'});
						  fnProcessMessage(message);
            } catch (err) {
              console.log(err);
            }
	        }
	        else if (method === '1[') {
	          var message = data.substr(1);
						fnProcessMessage(message);
	        }
          else {
            var message = data.split(",");
            fnRecieveAction(message);
          }
	      };
            /*self.onMessage = function(e) {
              console.warn("recv: "+e);
              var data = e.split(",");
              self.receiveAction(data);
            }*/
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
          //};
      },

      receiveAction: function(data) {
          var action = data.shift();
          if(this.handlers[action] && _.isFunction(this.handlers[action])) {
              this.handlers[action].call(this, data);
          }
          else {
              log.error("Unknown action : " + action);
          }
      },

      receiveActionBatch: function(actions) {
          var self = this;
          _.each(actions, function(action) {
              self.receiveAction(action);
          });
      },

      sendMessage: function(json) {
          var data;
          if(this.connection.connected === true) {
            console.warn("sent=" + JSON.stringify(json));
            if(this.useBison) {
              data = BISON.encode(json);
            } else {
              data = JSON.stringify(json);
            }
          try {
              this.connection.send("1"+data);
          } catch (err) {
            console.log(err);
          }
        }
      },

      onConnected: function() {
        log.info("Starting client/server handshake");

        this.sendUserConnected();
        //this.sendSyncTime();

        /*switch (this.initialAction)
        {
        case 1: // login user.
          log.info("sendLogin");
          client.sendLoginUser();
          break;
        case 2: // create user.
          client.sendCreateUser();
          break;
        }*/
      },

      onPlayerSummary: function (data) {
        user.setPlayerSummary(data);

        var count = user.playerSum.length;
        for (var i=0; i < count; ++i)
        {
          var ps = user.playerSum[i];
          var option = ps.name + " Lv" + Types.getLevel(ps.exp);

          var o = new Option(option, i);
          $('#player_select').append(o);
        }

        app.loadWindow('user_window', 'player_window');
        $('#player_select').focus();

        if (count > 0) {
          $('#player_select option[value="'+(count-1)+'"]').attr("selected",true);
          app.showPlayerLoad();
        }

        if (count == 0)
        {
          app.showPlayerCreate();
        }
        else
        {
          $('#player_create_form').hide();
        }
      },

      onWorlds: function (data) {
        for (var i = 0; i < data.length; i += 4)
        {
          $("#player_server").append("<option value="+data[i]+">"+
            data[i+1]+" "+data[i+2]+"/"+data[i+3]+"</option");
        }
        $('#user_create').removeClass('loading');
        $('#user_load').removeClass('loading');
        app.$loginInfo.text("Connected.");
      },

      _onError: function (data) {
          var message = data[0];
          $('#container').addClass('error');
          $('#errorwindow .errordetails').html("<p>"+message+"</p>");
          app.loadWindow('loginwindow','errorwindow');
      },

      onVersion: function (data) {
        game.onVersionUser(data);
      },

      /*onVersion: function(data) {
        //var self;
        this.versionChecked = true;
        var version = data[0];
        var hash = data[1];
        this.hashChallenge = hash;
        log.info("onVersion: hash="+hash);

        log.info("config.build.version="+config.build.version);
        if (version != config.build.version)
        {
          $('#container').addClass('error');
          var errmsg = "Please download the new version of RRO2.<br/>";

          if (game.renderer.isMobile) {
            errmsg += "<br/>For mobile see: " + config.build.updatepage;
          } else {
            errmsg += "<br/>For most browsers press Ctrl+F5 to reload the game cache files.";
          }
          game.clienterror_callback(errmsg);
          if (this.tablet || this.mobile)
            window.location.replace(config.build.updatepage);
        }
      },*/

      onSyncTime: function (data) {
        setWorldTime(parseInt(data[0]), parseInt(data[1]))
      },

      onWorldReady: function (data) {
        this.connection.disconnect();
        game.onWorldReady(data);
      },

      onError: function (data) {
        var error = data[0];

        switch(error) {
          case 'full':
          case 'invalidlogin':
          case 'userexists':
          case 'playerexists':
          case 'loggedin':
          case 'invalidusername':
          case 'ban':
          case 'passwordChanged':
          case 'timeout':
            app.info_callback(data);
            return;
          case 'timeout':
            app.info_callback(data);
            self.isTimeout = true;
            return;
        }
        this._onError(data);
      },

      sendUserConnected: function() {
          this.sendMessage([Types.UserMessages.CU_CONNECT_USER]);
      },

      sendLoginUser: function (user) {
        this.sendMessage([Types.UserMessages.CU_LOGIN_USER,
                          user.username,
                          user.hash]);
      },

      sendCreateUser: function (user) {
        this.sendMessage([Types.UserMessages.CU_CREATE_USER,
                          user.username,
                          user.hash]);
      },

      sendRemoveUser: function (user) {
        this.sendMessage([Types.UserMessages.CU_REMOVE_USER,
                          user.username,
                          user.hash]);
      },

      sendLoginPlayer: function (worldIndex, playerIndex) {
        this.sendMessage([Types.UserMessages.CU_LOGIN_PLAYER,
                          worldIndex,
                          playerIndex]);
      },

      sendCreatePlayer: function (worldIndex, playerName) {
        this.sendMessage([Types.UserMessages.CU_CREATE_PLAYER,
          worldIndex,
          playerName]);
      }

  });

  return UserClient;

});

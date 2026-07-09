
define([], function() {
    var ChatHandler = Class.extend({
        init: function(game) {
            var self = this;
            //this.game = game;
            //this.client = game.client;
            //this.kkhandler = kkhandler;
            this.chatLog = $('#chatLog');
            //handle global announcements server sided so
            //they're always synced.
            this.bumpOffDelay = 30000;
        },
        show: function(){
          $('#chatLog').css('display', 'flex');
        },
        processSendMessage: function(message) {
          return this.processSenders(null, message);
        },
        processReceiveMessage: function(entityId, message) {
          return this.processRecievers(entityId, message);
        },

        handleAddSpawn: function (data) {
      		log.info("sendAddSpawn");
      		var m = game.getMouseGridPosition();
      		if (data.length === 2)
      			game.client.sendAddSpawn(parseInt(data[1]), m.x, m.y);
        },

        handleSaveSpawns: function (data) {
        	game.client.sendSaveSpawns();
        },

        handleIdEntity: function (data) {
      		var m = game.getMouseGridPosition();
      		var entity = game.getEntityAt(m.x, m.y);
      		if (entity)
      		{
      			// FIX: entity.name is untrusted/server-controlled; escape before inserting as HTML to prevent XSS
      			this.addToChatLog("entity name: " + Utils.escapeHtml(entity.name) + ", id: " + entity.id +
      			    ", kind: " + entity.kind + ", pos: (" + m.x + "," + m.y + ")");
      		}
        },

        handleWarp: function (data) {
      		var p = game.player;
      		if (p.warpX && p.warpY)
      		{
      			this.teleportTo(p.warpX, p.warpY);
      		}
        },

        handlePartyInvite: function(data) {
        	game.client.sendPartyInvite(data[0], 0);
        },

        handlePartyLeader: function(data) {
        	game.client.sendPartyLeader(data[0]);
        },

        handlePartyLeave: function(data) {
        	game.client.sendPartyLeave();
        },

        handlePartyKick: function(data) {
        	game.client.sendPartyKick(data[0]);
        },

        handleAutoPotion: function (data) {
    			game.useAutoPotion = parseInt(data[0]);
        },

        processSenders: function(entityId, message) {
                var data = message.split(" ",5);
                if (!data) data[0] = message;

                switch (data.shift())
                {
                    case "/as":
                        this.handleAddSpawn(data);
                    	return true;
                    case "/savespawns":
                    	this.handleSaveSpawns(data);
                    	return true;
                    case "/id":
                    	this.handleIdEntity(data);
                        return true;
                    case "/warp":
                    	this.handleWarp(data);
                    	return true;
                    case "/party":
                    case "/invite":
                    	this.handlePartyInvite(data);
                    	return true;
                    case "/leader":
                    	this.handlePartyLeader(data);
                    	return true;
                    case "/leave":
                    	this.handlePartyLeave(data);
                    	return true;
                    case "/kick":
                    	this.handlePartyKick(data);
                    	return true;
                    case "/autopotion":
                    	this.handleAutoPotion(data);
                    	return true;
                }
                			//#cli guilds
			var regexp = /^\/guild\ (invite|create|accept)\s+([^\s]*)|(guild:)\s*(.*)$|^\/guild\ (leave)$/i;
			var args = message.match(regexp);
			if(Array.isArray(args) && args.length > 1){
				switch(args[1]){
					case "invite":
						if(game.player.hasGuild()){
							game.client.sendGuildInvite(args[2]);
						}
						else{
							this.addNotification("You are not in a guild.");
						}
						break;
					case "create":
						game.client.sendNewGuild(args[2]);
						break;
					case undefined:
						if(args[5]==="leave"){
							game.client.sendLeaveGuild();
						}
						else if(game.player.hasGuild()){
							game.client.talkToGuild(args[4]);
						}
						else{
							this.addNotification("You got no-one to talk to…");
						}
						break;
					case "accept":
						var status;
						if(args[2] === "yes") {
							status = game.player.checkInvite();
							if(status === false){
								this.addNotification("You were not invited anyway…");
							}
							else if (status < 0) {
								this.addNotification("Sorry to say it's too late…");
								setTimeout(function(){self.addNotification("Find someone and ask for another invite.")},2500);
							}
							else{
								game.client.sendGuildInviteReply(game.player.invite.guildId, true);
							}
						}
						else if(args[2] === "no"){
							status = game.player.checkInvite();
							if(status!==false){
								game.client.sendGuildInviteReply(game.player.invite.guildId, false);
								game.player.deleteInvite();
							}
							else{
								this.addNotification("Whatever…");
							}
						}
						else{
							this.addNotification("“guild accept” is a YES or NO question!!");
						}
						break;
				}
				return true;
			}
        	var pattern = message.substring(0, 3),
                self = this,
                commandPatterns = {
                      	"/g ": function(message) {
                      		if(game.player.hasGuild()){
                      			game.client.talkToGuild(message);
                      		}
                      		else{
                      			self.addNotification("You got no-one to talk to…");
                      		}
                      		return true;
						},
                		"/w ": function(message) {
                            var name = game.player.name,
                                rights = game.player.rights;

                            //'hacking' this will cause no issues
                            //as they grant no advantages
                            switch (rights) {
                                case 2:
                                    name = "[Admin]" + name;
                                break;

                                case 1:
                                    name = "[Moderator]" + name;
                                break;
                                //no default needed.
                            }

                            game.client.sendChat("/s " + name + ": " + message);
                            return true;
                      },
                      "// ": function(message) {
                          game.client.sendChat("// " + game.player.name + ": " + message);
                          return true;
                      },
                      // FIX: removed dead commented-out /re, /to, /te command handlers (unreachable, unused)
                      "///": function(message) {
                          game.client.sendChat("/// " + game.player.name + ": " + message);
                          return true;
                      },
                };
                if (pattern in commandPatterns) {
                      if (typeof commandPatterns[pattern] === "function") {
                          return commandPatterns[pattern](message.substring(3));
                      }
                }
            return false;
        },
        processRecievers: function(entityId, message) {
        		if (message.indexOf("/") !== 0)
        			return false;

        		//var regexp = /^\/guild\ (invite|create|accept)\s+([^\s]*)|(guild:)\s*(.*)$|^\/guild\ (leave)$/i;
        		//var args = message.match(regexp);
        		//if (args) return false;

        		var data = message.split(" ",5);
                if (!data) data[0] = message;

                switch (data[0])
                {
                    case "/rn":
                        this.addRatingNotification(message.substr(4));
                    	return true;
                }

        	var pattern = message.substring(0, 3),
                self = this,
                commandPatterns = {
                        // World chat
                        "/1 ": function(entityId, message) {
                            // FIX: message is server-relayed/untrusted chat text; escape before inserting as HTML to prevent XSS
                            self.addToChatLog(Utils.escapeHtml(message));
                            return true;
                        },
                        "// ": function(entityId, message){
                            // FIX: message is server-relayed/untrusted chat text; escape before wrapping in trusted <font> tag to prevent XSS
                            self.addToChatLog('<font color="#00BFFF">' + Utils.escapeHtml(message) + '</font>');
                            return true;
                        },
                        "///": function(entityId, message){
                            var i=0;
                            var splitMsg = message.split(' ');
                            var msg = "";
                            for(i=0; i<splitMsg.length; i++){
                              if(i !== 3){
                                  msg += splitMsg[i] + " ";
                              }
                            }
                            // FIX: msg is server-relayed/untrusted chat text; escape before wrapping in trusted <font> tag to prevent XSS
                            self.addToChatLog('<font color="#FFA500">' + Utils.escapeHtml(msg) + '</font>');
                            return true;
                        },
                };
                if (pattern in commandPatterns) {
                      if (typeof commandPatterns[pattern] === "function") {
                          return commandPatterns[pattern](entityId, message.substring(3));
                      }
                }
            return false;
        },
        bumpOffLog: function (delay) {
          var delay = delay || this.bumpOffDelay;
          var self = this;
          $(this.chatLog).scrollTop(999999);
          setTimeout(function () {
            $(this.chatLog).find("p:first").remove();
          }, delay);
        },

        addToChatLog: function(message){
            // FIX: message may be raw untrusted chat text (see call sites); callers now escape untrusted
            // content before calling this, since some callers intentionally wrap pre-built trusted HTML (e.g. <font> tags)
            var self = this;
            var el = $('<p style="color: white">' + message + '</p>');
            $(el).appendTo(this.chatLog);
            this.bumpOffLog();
        },
        addNotification: function(message){
            var self = this;
            var el = $('<p style="color: rgba(128, 255, 128, 1)">' + message + '</p>');
            $(el).appendTo(this.chatLog);
            this.bumpOffLog();
        },
        addNormalChat: function(entity, message) {
            var self = this;
            if (!entity) return;
            // FIX: entity.name and message are untrusted/server-controlled; escape before inserting as HTML to prevent XSS
            var el = $('<p style="color: rgba(255, 255, 0, 1)">' + Utils.escapeHtml(entity.name) + ': ' + Utils.escapeHtml(message) + '</p>');
            $(el).appendTo(this.chatLog);
            this.bumpOffLog();
        },

        addGameNotification: function(notificationType, message) {
            var self = this;
            // FIX: message may be untrusted/server-controlled; escape before inserting as HTML to prevent XSS
        	  var el = $('<p style="color: rgba(255, 255, 0, 1)">' + notificationType + ': ' + Utils.escapeHtml(message) + '</p>');
            $(el).appendTo(this.chatLog);
            this.bumpOffLog();
        },

        addRatingNotification: function(message) {
            var self = this;
            // FIX: message is untrusted/server-controlled; escape before inserting as HTML to prevent XSS
            var el = $('<p style="color: rgba(255, 255, 0, 1)">' + Utils.escapeHtml(message) + '</p>');
            $(el).appendTo(this.chatLog);
            this.bumpOffLog();
        }

    });
    return ChatHandler;
});

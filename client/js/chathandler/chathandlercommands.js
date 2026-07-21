// Mixin extracted from chathandler.js: the chat-command dispatchers (processSenders/
// processRecievers, the big "/command" switch/pattern-match blocks) plus the small
// handleXxx() helpers only ever called from within processSenders. Applied onto
// ChatHandler.prototype via installChatHandlerCommands(...) call in chathandler.js; not a
// standalone class.

/* global Utils */

export function installChatHandlerCommands(proto) {

        proto.handleAddSpawn = function(data) {
      		log.info("sendAddSpawn");
      		const m = game.getMouseGridPosition();
      		if (data.length === 2)
      			game.client.sendAddSpawn(parseInt(data[1]), m.x, m.y);
        };

        proto.handleSaveSpawns = function(data) {
        	game.client.sendSaveSpawns();
        };

        proto.handleIdEntity = function(data) {
      		const m = game.getMouseGridPosition();
      		const entity = game.getEntityAt(m.x, m.y);
      		if (entity)
      		{
      			// FIX: entity.name is untrusted/server-controlled; escape before inserting as HTML to prevent XSS
      			this.addToChatLog("entity name: " + Utils.escapeHtml(entity.name) + ", id: " + entity.id +
      			    ", kind: " + entity.kind + ", pos: (" + m.x + "," + m.y + ")");
      		}
        };

        proto.handleWarp = function(data) {
      		const p = game.player;
      		if (p.warpX && p.warpY)
      		{
      			this.teleportTo(p.warpX, p.warpY);
      		}
        };

        proto.handlePartyInvite = function(data) {
        	game.client.sendPartyInvite(data[0], 0);
        };

        proto.handlePartyLeader = function(data) {
        	game.client.sendPartyLeader(data[0]);
        };

        proto.handlePartyLeave = function(data) {
        	game.client.sendPartyLeave();
        };

        proto.handlePartyKick = function(data) {
        	game.client.sendPartyKick(data[0]);
        };

        proto.handleAutoPotion = function(data) {
    			game.useAutoPotion = parseInt(data[0]);
        };

        proto.processSenders = function(entityId, message) {
                const data = message.split(" ",5);
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
    			const regexp = /^\/guild\ (invite|create|accept)\s+([^\s]*)|(guild:)\s*(.*)$|^\/guild\ (leave)$/i;
    			const args = message.match(regexp);
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
    						let status;
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
            	const pattern = message.substring(0, 3),
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
                                let name = game.player.name,
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
        };

        proto.processRecievers = function(entityId, message) {
        		if (message.indexOf("/") !== 0)
        			return false;

        		//var regexp = /^\/guild\ (invite|create|accept)\s+([^\s]*)|(guild:)\s*(.*)$|^\/guild\ (leave)$/i;
        		//var args = message.match(regexp);
        		//if (args) return false;

        		const data = message.split(" ",5);
                if (!data) data[0] = message;

                switch (data[0])
                {
                    case "/rn":
                        this.addRatingNotification(message.substr(4));
                    	return true;
                }

        	const pattern = message.substring(0, 3),
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
                            let i=0;
                            const splitMsg = message.split(' ');
                            let msg = "";
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
        };

}

// Converted from AMD (define) + Class.extend to a native ES6 module/class.
/* global Utils */

export default class SocialHandler {
    constructor(game) {
		var self = this;

		this.game = game;
		this.toggle = false;

		this.partymembers = [];
		$('#partyleave').click(function(event){
			self.game.client.sendPartyLeave();
			$('#partynames').html("");
			self.show();
		});
		$('#partyclose').click(function(e){
				self.show();
		});

		this.guildmembers = [];
		$('#guildleave').click(function(event){
			self.game.client.sendLeaveGuild();
			$('#guildnames').html("");
			self.show();
		});
		$('#socialclose').click(function(e){
				self.show();
		});

    }

    inviteParty(invitee)
    {
		var self = this;

		// FIX: invitee.name is untrusted/server-controlled; escape before inserting as HTML to prevent XSS
		$('#socialconfirmtitle').html("Party " + Utils.escapeHtml(invitee.name) + "?");

      $('#socialconfirm').show();
	    $('#socialconfirmyes').on('click', function(event){
		    self.game.client.sendPartyInvite(invitee.name, 1);
		    $('#socialconfirm').hide();
	    });
	    $('#socialconfirmno').off().on('click', function(event){
		    self.game.client.sendPartyInvite(invitee.name, 2);
		    $('#socialconfirm').hide();
	    });

       setTimeout(function () {
         $('#socialconfirm').hide();
       }, 10000);
    }

    inviteGuild(guildId, guildName, invitorName)
    {
		var self = this;

      // FIX: guildName is untrusted/server-controlled; escape before inserting as HTML to prevent XSS
      $('#socialconfirmtitle').html("Join Guild " + Utils.escapeHtml(guildName) + "?");

        $('#socialconfirm').show();
  	    $('#socialconfirmyes').on('click', function(event){
  		    self.game.client.sendGuildInviteReply(guildId, true);
  		    $('#socialconfirm').hide();
  	    });
  	    $('#socialconfirmno').on('click', function(event){
  		    self.game.client.sendGuildInviteReply(guildId, false);
  		    $('#socialconfirm').hide();
  	    });

         setTimeout(function () {
           $('#socialconfirm').hide();
         }, 10000);
    }

    show() {
        this.toggle = !this.toggle;
    	if (this.toggle)
    	{
            this.displayParty();
			this.displayGuild();
			$('#socialwindow').css('display', 'block');
        }
        else
        {
            $('#socialwindow').css('display', 'none');
        }
    }
    setPartyMembers(members){
      this.partymembers = members;
      this.displayParty();
    }

    setGuildMembers(members){
      this.guildmembers = members;
      this.displayGuild();
    }

    displayParty() {
      if (this.partymembers.length <= 1)
      {
      	  $('#partynames').html("No party.");
          return;
      }
	  else
	  {
		  $('#partyleave').show();
	  }

      // FIX: party member names are untrusted/server-controlled; escape before inserting as HTML to prevent XSS
      var htmlStr = "<table><tr><th>Name</th></tr>";
      htmlStr += "<tr><td>" + Utils.escapeHtml(this.partymembers[0]) + " (L)</td></tr>";
      for(var i=1; i < this.partymembers.length; ++i){
          htmlStr += "<tr><td>" + Utils.escapeHtml(this.partymembers[i]) + "</td></tr>";
      }
      htmlStr += "</table>";
      $('#partynames').html(htmlStr);
    }

    displayGuild() {
      if (this.guildmembers.length <= 0)
      {
      	  $('#guildnames').html("No guild.");
          return;
      }
	  else
	  {
		  $('#guildleave').show();
	  }

      // FIX: guild member names are untrusted/server-controlled; escape before inserting as HTML to prevent XSS
      var htmlStr = "<table><tr><th>Name</th></tr>";
      htmlStr += "<tr><td>" + Utils.escapeHtml(this.guildmembers[0]) + " (L)</td></tr>";
      for(var i=1; i < this.guildmembers.length; ++i){
          htmlStr += "<tr><td>" + Utils.escapeHtml(this.guildmembers[i]) + "</td></tr>";
      }
      htmlStr += "</table>";
      $('#guildnames').html(htmlStr);

    }

    isPartyLeader(name) {
    	return name === this.partymembers[0];
    }

    isPartyMember(name) {
    	return (this.partymembers.indexOf(name) > -1);
    }

    isGuildLeader(name) {
    	return name === this.guildmembers[0];
    }

    isGuildMember(name) {
    	return (this.guildmembers.indexOf(name) > -1);
    }
}

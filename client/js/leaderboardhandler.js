define([], function() {
  var LeaderboardHandler = Class.extend({
    init: function(game) {
    	this.game = game;
    	this.toggle = false;

    	var self = this;
    	$('#leaderboardclose').click(function(e){
                self.show();
    	});
    },

    show: function() {
        this.toggle = !this.toggle;
    	if (this.toggle)
    	{
            $('#leaderboard').css('display', 'block');
            this.display();
        }
        else
        {
            $('#leaderboard').css('display', 'none');
        }
    },
    display: function () {
    	var self = this;
    	var leaderJSON;
    	var recordsPerPage = 10;

	  var callback = function () {
		var leaders = [];


		switch($('#lbselect').val())
		{
		    case 'xp':
			$.each( leaderJSON, function( key, value ) {
				if (value.xp > 0)
					leaders.push({"key": key, "value": Types.getLevel(value.xp)});
			});
			break;
		    case 'pk':
			$.each( leaderJSON, function( key, value ) {
				if (value.pk > 0)
					leaders.push({"key": key, "value": value.pk});
			});
			break;
		    case 'pkd':
			$.each( leaderJSON, function( key, value ) {
				var pkd = (value.pd>0) ? Number(value.pk / value.pd).toFixed(2):0;
				if (pkd > 0)
					leaders.push({"key": key, "value": pkd});
			});
			break;
		    case 'pd':
			$.each( leaderJSON, function( key, value ) {
				if (value.pd > 0)
					leaders.push({"key": key, "value": value.pd});
			});
			break;
		    case 'tk':
			$.each( leaderJSON, function( key, value ) {
				if (value.tk > 0)
					leaders.push({"key": key, "value": value.tk});
			});
			break;
		    case 'td':
			$.each( leaderJSON, function( key, value ) {
				if (value.td > 0)
					leaders.push({"key": key, "value": value.td});
			});
			break;
		    case 'tkd':
			$.each( leaderJSON, function( key, value ) {

				var tkd = (value.td>0) ? Number(value.tk / value.td).toFixed(2):0;
				if (tkd > 0)
					leaders.push({"key": key, "value": tkd});
			});
			break;
		}
		//log.info(JSON.stringify(leaders));

		leaders.sort(function (a,b) { return b.value-a.value });

		var playerIndex = -1;
		var leadersLength = leaders.length;
		for (var i=0; i < leadersLength; ++i)
		{
			var leader = leaders[i];
			if (self.game.player.name == leader.key)
			{
				playerIndex = i;
				break;
			}
		}

		var recStart;
		var recEnd;

		var pageIndex;
		if (parseInt($('#lbindex').val()) > 0)
			pageIndex = parseInt($('#lbindex').val());
		else if (playerIndex >= 0)
			pageIndex = Math.ceil(playerIndex/recordsPerPage);
		else
			pageIndex = 1;

		//alert(pageIndex);
		if (pageIndex > 0)
		{
			recStart = (pageIndex-1) * recordsPerPage;
			recEnd = Math.min(leaders.length,recStart+recordsPerPage);;
		}
		else
		{
			recStart = 0;
			recEnd = Math.min(leaders.length,recStart+recordsPerPage);
		}

		var lbdata = "<table><tr><th>Rank</th><th>Name</th><th>Score</th></tr>";
		for (var i=recStart; i < recEnd; ++i)
		{
			var leader = leaders[i];
			if (i == playerIndex)
				lbdata += "<tr class=\"lbplayer\"><td>"+(i+1)+"</td><td>"+leader.key+"</td><td>"+leader.value+"</td></tr>";
			else
				lbdata += "<tr><td>"+(i+1)+"</td><td>"+leader.key+"</td><td>"+leader.value+"</td></tr>";
		}
		lbdata += "</table>";
		$('#lbdata').html(lbdata);


		var pagesCount = Math.ceil(leadersLength / recordsPerPage);
		//alert(leadersLength + " " + recordsPerPage + " " + pagesCount);
		var pageData;
		for (var i = 1; i <= pagesCount; ++i)
		{
			if (pageIndex == i)
			    pageData += "<option value=\""+i+"\" selected>"+i+"</option>";
			else
			    pageData += "<option value=\""+i+"\">"+i+"</option>";
		}
		$('#lbindex').empty();
		$('#lbindex').html(pageData);

	  };

    	$('#lbselect').change(function () {
    		$('#lbindex').val('');
    		callback();
    	});

    	$('#lbindex').change(function () {
    		callback();
    	});

// TODO - FIX.
  return;

	fetch('https://www.landofmana.com/play/leader.json')
	  .then(
	    function(response) {
	      if (response.status !== 200) {
      		console.log('Looks like there was a problem. Status Code: ' +
      		  response.status);
      		return;
	      }

	      // Examine the text in the response
	      response.json().then(function(data) {
      		console.log(data);
      		leaderJSON = data;
      		callback();
	      });
	    }
	  )
	  .catch(function(err) {
	    console.log('Fetch Error :-S', err);
	  });
    },

  });

  return LeaderboardHandler;
});

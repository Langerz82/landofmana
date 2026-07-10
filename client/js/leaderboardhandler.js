// Converted from AMD (define) + Class.extend to a native ES6 module/class.
/* global Types, Utils */

export default class LeaderboardHandler {
    constructor(game) {
    	this.game = game;
    	this.toggle = false;

    	const self = this;
    	$('#leaderboardclose').click(function(e){
                self.show();
    	});
    }

    show() {
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
    }
    display() {
    	const self = this;
    	let leaderJSON;
    	const recordsPerPage = 10;

	  const callback = function () {
		const leaders = [];


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
				const pkd = (value.pd>0) ? Number(value.pk / value.pd).toFixed(2):0;
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

				const tkd = (value.td>0) ? Number(value.tk / value.td).toFixed(2):0;
				if (tkd > 0)
					leaders.push({"key": key, "value": tkd});
			});
			break;
		}
		//log.info(JSON.stringify(leaders));

		leaders.sort(function (a,b) { return b.value-a.value });

		let playerIndex = -1;
		const leadersLength = leaders.length;
		for (var i=0; i < leadersLength; ++i)
		{
			const leader = leaders[i];
			if (self.game.player.name === leader.key)
			{
				playerIndex = i;
				break;
			}
		}

		let recStart;
		let recEnd;

		let pageIndex;
		if (parseInt($('#lbindex').val()) > 0)
			pageIndex = parseInt($('#lbindex').val());
		else if (playerIndex >= 0)
			// FIX: Math.ceil(playerIndex/recordsPerPage) is off by one whenever playerIndex is an exact multiple
			// of recordsPerPage (e.g. rank 11, 21, 31...), landing one page too early so the player's own row
			// wasn't shown; page number is (0-based index / pageSize) floored, plus 1
			pageIndex = Math.floor(playerIndex/recordsPerPage) + 1;
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

		let lbdata = "<table><tr><th>Rank</th><th>Name</th><th>Score</th></tr>";
		for (var i=recStart; i < recEnd; ++i)
		{
			const leader = leaders[i];
			if (i === playerIndex)
				lbdata += "<tr class=\"lbplayer\"><td>"+(i+1)+"</td><td>"+Utils.escapeHtml(leader.key)+"</td><td>"+leader.value+"</td></tr>"; // FIX: leader.key (player name) is untrusted; escape before inserting as HTML to prevent XSS
			else
				lbdata += "<tr><td>"+(i+1)+"</td><td>"+Utils.escapeHtml(leader.key)+"</td><td>"+leader.value+"</td></tr>"; // FIX: leader.key (player name) is untrusted; escape before inserting as HTML to prevent XSS
		}
		lbdata += "</table>";
		$('#lbdata').html(lbdata);


		const pagesCount = Math.ceil(leadersLength / recordsPerPage);
		//alert(leadersLength + " " + recordsPerPage + " " + pagesCount);
		let pageData = ""; // FIX: was uninitialized, producing literal "undefined<option...>" on first concat
		for (var i = 1; i <= pagesCount; ++i)
		{
			if (pageIndex === i)
			    pageData += "<option value=\""+i+"\" selected>"+i+"</option>";
			else
			    pageData += "<option value=\""+i+"\">"+i+"</option>";
		}
		$('#lbindex').empty();
		$('#lbindex').html(pageData);

	  };

    	// FIX: display() runs every time the leaderboard is opened (see show()), and this
    	// bound a fresh change() handler onto the same #lbselect/#lbindex elements each
    	// time without unbinding the previous one. Repeated opens stacked duplicate
    	// handlers, so one dropdown change re-ran callback() (and its DOM rebuild) once
    	// per past open. .off('change') before rebinding keeps it to a single handler.
    	$('#lbselect').off('change').change(function () {
    		$('#lbindex').val('');
    		callback();
    	});

    	$('#lbindex').off('change').change(function () {
    		callback();
    	});

    	// FIX: removed dead/unreachable fetch() block (was after an unconditional `return;`, marked TODO - FIX)
    }
}

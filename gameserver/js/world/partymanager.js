import PlayerGroup from '../playergroup.js';
import Message from '../message.js';

class PartyManager {
    constructor(world) {
        this.world = world;
        this.party = [];
    }

    addParty(player1, player2)
    {
        const party = new PlayerGroup(player1, "party", true);
        party.setMemberMessage(Message.Party);
        party.addName(player2.name);
        this.party.push(party);
        return party;
    }

    // FIX: `.remove(party)` isn't a native Array method -- threw a TypeError
    // on every call. The rest of this codebase has its own array-removal
    // polyfill for exactly this, `removeVal` (see utils.js, and its other
    // callers in worldserver.js/packethandler.js/playergroup.js).
    removeParty(party)
    {
        this.party.removeVal(party);
        //this.party.splice(this.party.indexOf(party), 1);
        /*this.party = _.reject(this.party, function(el)
        {
            return el === party;
        });*/
        party = null;
    }

    removePlayer(player) {
        if (player.hasOwnProperty("party") && player.party)
        {
            const party = player.party;
            party.removeName(player.name);
            player.packetHandler.partyHandler.handlePartyAbandoned(party);
        }
    }


}

export default PartyManager;

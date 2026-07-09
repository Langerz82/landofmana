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

    // NOTE: pre-existing bug preserved from the original — `.remove(party)` is
    // not a native Array method; the rest of the codebase's own array-removal
    // helper is named `removeVal` (see e.g. PlayerQuests.removeQuest), so this
    // would throw a TypeError at runtime in the original CommonJS version too.
    removeParty(party)
    {
        this.party.remove(party);
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

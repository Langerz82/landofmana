// This file is part of Land of Mana (https://github.com/Langerz82/landofmana).
// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2023-2026 Joshua Langley and contributors
// Portions derived from BrowserQuest (Little Workshop) and BrowserQuest-Asky, MPL-2.0.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, version 3 of the License.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program. See the LICENSE file in the project root,
// or <https://www.gnu.org/licenses/>.

import PlayerGroup from '../playergroup.js';
import Message from '../message.js';
import Utils from '../utils.js';

class PartyManager {
    constructor(world) {
        this.world = world;
        this.party = [];
    }

    addParty(player1, player2) {
        const party = new PlayerGroup(player1, 'party', true);
        party.setMemberMessage(Message.Party);
        party.addName(player2.name);
        this.party.push(party);
        return party;
    }

    // FIX: `.remove(party)` isn't a native Array method -- threw a TypeError
    // on every call. Uses Utils.removeFromArray() instead (see utils.js, and
    // its other callers in worldserver.js/packethandler.js/playergroup.js/
    // playerquests.js).
    removeParty(party) {
        Utils.removeFromArray(this.party, party);
        //this.party.splice(this.party.indexOf(party), 1);
        /*this.party = _.reject(this.party, function(el)
        {
            return el === party;
        });*/
        party = null;
    }

    removePlayer(player) {
        if (player.hasOwnProperty('party') && player.party) {
            const party = player.party;
            party.removeName(player.name);
            // FIX: called the nonexistent handlePartyAbandoned(); the only
            // defined method is handleAbandoned(party) (packets/partyhandler.js,
            // see its correct use in handleLeave/handleKick there). This threw
            // on every disconnect of a partied player, which is invoked from
            // worldserver.js's packetHandler.onExit callback -- the throw
            // aborted everything after it in that callback (removing the
            // player from the world's `players` map and from
            // map.entities), leaving a permanent ghost session behind.
            player.packetHandler.partyHandler.handleAbandoned(party);
        }
    }
}

export default PartyManager;

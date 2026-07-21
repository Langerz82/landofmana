import Messages from '../message.js';
import Player from '../entity/player/player.js';

class PartyHandler {
    constructor(packetHandler) {
        this.ph = packetHandler;
        this.world = this.ph.world;
        this.player = this.ph.player;
    }

    getPlayer(name) {
        if (!name) return null;
        const normalized = name.toLowerCase().trim();
        const player = this.world.getPlayerByName(normalized);
        if (!player) {
            this.player.sendPlayer(new Messages.Notify("CHAT", "NO_PLAYER_EXIST", [name]));
            return null;
        }
        return player;
    }

    handleParty(msg) {
        const partyType = msg.shift();
        switch (partyType) {
        case 1:
            this.handleInvite(msg);
            break;
        case 2:
            this.handleKick(msg);
            break;
        case 3:
            this.handleLeader(msg);
            break;
        case 4:
            this.handleLeave(msg);
            break;
        }
    }

    handleInvite(msg) {
        const name = msg[0];
        const player2 = this.getPlayer(name);
        if (!player2) {
            return;
        }

        const status = msg[1];

        const party = this.player.party;

        if (this.player === player2)
            return;

        if (status === 0) {
            if (party && party.players.length >= 5) {
                this.player.sendPlayer(new Messages.Notify("CHAT", "PARTY_MAX_PLAYERS"));
                return;
            }
            // FIX: `party.leader` is a name string (see playergroup.js
            // setLeader), so `(!party || party.leader)` only ever tested
            // "party.leader is a non-empty string" -- true for every
            // existing party regardless of who's inviting, letting any
            // member send invites instead of just the leader. Compare
            // identity by name instead, matching the pattern used by
            // handleKick/handleLeader below.
            if ((!party || party.leader === this.player.name) && player2 instanceof Player) {
                this.player.sendToPlayer(player2, new Messages.PartyInvite(this.player.id));
                this.player.sendPlayer(new Messages.Notify("CHAT", "PARTY_PLAYER_INVITE_SENT", [player2.name]));
            }
        } else if (status === 1) {
            // FIX: PlayerGroup.players stores name strings (see
            // playergroup.js containsName/addName/removeName -- all keyed by
            // `playerName`), but this passed whole Player objects. Since a
            // Player object never strict-equals a stored name string,
            // containsName() always returned false: removeName() silently
            // no-op'd (never removed the departing party) and addName()
            // pushed a Player object into an array meant to hold names
            // (corrupting sendMembersName()'s player-list packets) while
            // still failing its own containsName() check, so player2.party
            // was never actually set. Pass .name instead.
            if (player2.party) {
                player2.party.removeName(player2.name);
                //this.handlePartyAbandoned(player2.party);
            }
            if (party) {
                if (party.players.length >= 5) {
                    this.player.sendPlayer(new Messages.Notify("CHAT", "PARTY_MAX_PLAYERS"));
                    return;
                }
                party.addName(player2.name);
            } else {
                if (this.world && this.world.party)
                    this.world.party.addParty(player2, this.player);
                else {
                    console.warn("no world or no world party.");
                }
            }

            if (player2) {
                this.player.sendToPlayer(player2, new Messages.Notify("CHAT", "PARTY_PLAYER_JOINED", [this.player.name]));
                this.player.sendPlayer(new Messages.Notify("CHAT", "PARTY_PLAYER_ADDED", [player2.name]));
            }
        } else if (status === 2) {
            this.player.sendPlayer(new Messages.Notify("CHAT", "PARTY_YOU_REJECTED_INVITE", [player2.name]));
            this.player.sendToPlayer(player2, new Messages.Notify("CHAT", "PARTY_THEY_REJECTED_INVITE", [player2.name]));
        }

    }

    handleKick(msg) {
        const name = msg[0];
        const player2 = this.getPlayer(name);
        if (!player2) {
            return;
        }
        if (this.player === player2)
            return;

        const party = this.player.party;

        if (!party) {
            this.player.sendPlayer(new Messages.Notify("CHAT", "PARTY_CANNOT_KICK"));
            return;
        }

        // FIX: `party.leader` is a name string (playergroup.js), but this
        // compared it to a Player object with `===` -- always false, so the
        // real party leader could never kick anyone (always fell through to
        // "PARTY_CANNOT_KICK" below). Compare by name instead.
        if (this.player.name === party.leader) {
            // FIX: removeName() expects a name string, not a Player object
            // (see playergroup.js) -- passing player2 meant a kicked player
            // was never actually removed from party.players.
            party.removeName(player2.name);
            if (player2 instanceof Player)
                this.player.sendToPlayer(player2, new Messages.Notify("CHAT", "PARTY_PLAYER_KICKED"));
            // FIX: called the nonexistent this.handlePartyAbandoned(); the
            // only defined method is handleAbandoned(party) (see its correct
            // use in handleLeave below). Threw every time a party leader
            // kicked a member.
            this.handleAbandoned(party);
        } else {
            this.player.sendPlayer(new Messages.Notify("CHAT", "PARTY_CANNOT_KICK"));
        }
    }

    handleLeader(msg) {
        const name = msg[0];
        const player2 = this.getPlayer(name);
        if (!player2) {
            return;
        }

        if (this.player === player2)
            return;

        const party = this.player.party;
        if (!party) {
            this.player.sendPlayer(new Messages.Notify("CHAT", "PARTY_NOT_LEADER"));
            return;
        }

        // FIX: same Player-object-vs-name-string comparison bug as
        // handleKick above -- always false, so leadership could never
        // actually be transferred by the real leader. Also `party.leader`
        // is already the name string itself (playergroup.js), not a Player
        // object, so `.name` below was always undefined; use it directly.
        if (this.player.name === party.leader) {
            party.setLeader(player2.name);

            this.player.sendToPlayer(player2, new Messages.Notify("CHAT", "PARTY_YOU_LEADER"));
            this.player.sendPlayer(new Messages.Notify("CHAT", "PARTY_PLAYER_LEADER", [party.leader]));
        } else {
            this.player.sendPlayer(new Messages.Notify("CHAT", "PARTY_IS_LEADER", [party.leader]));
        }
        party.sendMembersName();
    }

    handleLeave(msg) {
        const party = this.player.party;
        // FIX: `leader` used to be `party.leader` itself -- a name string
        // (playergroup.js), not a Player object -- but was then passed
        // straight into sendToPlayer() (which indexes player.id, so a
        // string silently no-ops there) and compared with `this.player !==
        // leader` (Player-vs-string, always true, so "you left" fired
        // unconditionally regardless of whether this.player actually was
        // the leader). Keep the name for identity comparisons and resolve
        // the actual Player object separately for sendToPlayer.
        const leaderName = (party) ? party.leader : null;

        if (leaderName === null)
            return;

        if (!party) {
            this.player.sendPlayer(new Messages.Notify("CHAT", "PARTY_NOT_IN"));
            return;
        }

        // FIX: removeName() expects a name string, not a Player object (see
        // playergroup.js) -- passing this.player meant a player leaving the
        // party was never actually removed from party.players.
        party.removeName(this.player.name);
        this.handleAbandoned(party);

        const leaderPlayer = this.world.getPlayerByName(leaderName);
        if (leaderPlayer)
            this.player.sendToPlayer(leaderPlayer, new Messages.Notify("CHAT", "PARTY_PLAYER_LEFT", [this.player.name]));

        if (this.player.name !== leaderName)
            this.player.sendPlayer(new Messages.Notify("CHAT", "PARTY_YOU_LEFT", [leaderName]));

    }

    handleAbandoned(party) {
        if (party.players.length !== 1)
            return;

        this.player.sendPlayer(new Messages.Notify("CHAT", "PARTY_ALL_LEFT"));
        this.player.sendPlayer(new Messages.Party([]));

        // FIX: `party.players[0]` is a name string (playergroup.js), never
        // a Player object -- `instanceof Player` was always false, so the
        // last remaining party member was never notified their party had
        // disbanded. Resolve the name to the actual online Player first.
        const remainingName = party.players[0];
        if (this.player.name !== remainingName) {
            const remainingPlayer = this.world.getPlayerByName(remainingName);
            if (remainingPlayer) {
                this.player.sendToPlayer(remainingPlayer, new Messages.Notify("CHAT", "PARTY_ALL_LEFT"));
                this.player.sendToPlayer(remainingPlayer, new Messages.Party([]));
            }
        }
        if (this.world && this.world.party)
            this.world.party.removeParty(party);
        else {
            console.warn("no world or no world party.");
        }
    }
}

export default PartyHandler;

import Messages from "./message.js";
import Utils from './utils.js';

class PlayerGroup {
  constructor(leader, group, allowOnce) {
    this.players = [];
    this.allowOnce = allowOnce;
    this.group = group;
    this.world = leader.world;

    this.addName(leader.name);
    this.setLeader(leader.name);
  }

  containsName(playerName) {
    return this.players.includes(playerName);
  }

  setLeader(playerName) {
      this.leader = playerName;
      const index = this.players.indexOf(this.leader);
      if (index != 0)
        Utils.SwapElements(this.players, 0, index);
  }

  addName(playerName) {
    if(playerName){
      if (this.players.length === 0) {
        this.leader = playerName;
      }
      if (!this.containsName(playerName)) {
        this.players.push(playerName);
      }

      const player = this.getPlayer(playerName);
      if (player) {
        if(this.allowOnce && player[this.group]) {
          player[this.group].removeName(playerName);
        }
        player[this.group] = this;
      }
    }
    this.sendMembersName();
  }

  getPlayer(playerName) {
    if(playerName) {
      const player = this.world.getPlayerByName(playerName);
      if (player)
        return player;
    }
    return null;
  }

  sendPlayers(msg, sendOwner) {
    const self = this;
    this.forEachName(function (playerName) {
      // FIX: this callback is a plain function passed through forEachName's
      // callback(...) invocation, so `this` is undefined here (ES modules are
      // strict mode, no implicit global `this`). Reading `this.leader` threw a
      // TypeError on every call, i.e. every party join/leave (sendMembersName
      // always calls sendPlayers(msg, true)). Use the closed-over `self` instead.
      if (sendOwner && self.leader === playerName)
        return;

      if(playerName) {
        const player = self.getPlayer(playerName);
        if (player)
          player.sendPlayer(msg);
      }
    })
  }

  forEachName(callback) {
    const length = this.players.length;
    for(let i=0; i < length; ++i){
      if (callback)
        callback(this.players[i]);
    }
  }

  forEachPlayer(callback) {
    const length = this.players.length;
    for(let i=0; i < length; ++i){
      if (callback) {
        const player = this.getPlayer(this.players[i]);
        if (player)
          callback(player);
      }
    }
  }

  removeName(playerName) {
    // FIX: `this.leader = this.players[0]` used to run BEFORE the removal
    // below. setLeader() always keeps the current leader at index 0, so at
    // the moment the departing leader's own name was reassigned here,
    // `this.players[0]` was still that same departing name -- a no-op.
    // Leadership never actually transferred to a remaining member; `leader`
    // was left pointing at a name no longer present in `players` at all.
    // Removing first, then picking the new players[0], actually promotes
    // whoever's next in line (or leaves `leader` undefined if the group is
    // now empty).
    if (playerName) {
      if (this.containsName(playerName)) {
        const player = this.getPlayer(playerName);
        if (player) {
          player[this.group] = null;
        }
        // FIX: removeVal() was an Array.prototype monkey-patch; migrated to
        // the named Utils.removeFromArray() helper (see utils.js).
        Utils.removeFromArray(this.players, playerName);
        //this.players.splice(this.players.indexOf(playerName), 1);
      }
      if (playerName === this.leader)
        this.leader = this.players[0];
      this.sendMembersName();
    }
  }

  setMemberMessage(msg) {
    this.memberMessage = msg;
  }

  sendMembersName() {
    if (this.memberMessage)
      this.sendPlayers(new this.memberMessage(this.players), true);
  }

}

export default PlayerGroup;

import _ from 'underscore';

// import Quest from './quest.js'; // commented out in original

import Types from '../shared/js/gametypes.js';

const UserMessages = {};

// Base Message class
class Message {
  // Base class can be empty or have common methods if needed
}

// WorldReady
UserMessages.WorldReady = class extends Message {
  constructor(user, protocol, address, port) {
    super();
    this.user = user;
    this.protocol = protocol;
    this.address = address;
    this.port = port;
  }

  serialize() {
    return [
      Types.UserMessages.UC_WORLD_READY,
      this.user.name,
      this.user.playerName,
      this.user.hash,
      this.protocol,
      this.address,
      this.port
    ];
  }
};

// LoadPlayerAuctions
UserMessages.LoadPlayerAuctions = class extends Message {
  constructor(data) {
    super();
    this.data = data;
  }

  serialize() {
    return [Types.UserMessages.UW_LOAD_PLAYER_AUCTIONS].concat(this.data);
  }
};

// LoadPlayerLooks
UserMessages.LoadPlayerLooks = class extends Message {
  constructor(data) {
    super();
    this.data = data;
  }

  serialize() {
    return [Types.UserMessages.UW_LOAD_PLAYER_LOOKS].concat(this.data);
  }
};

// LoadUserBans
UserMessages.LoadUserBans = class extends Message {
  constructor(data) {
    super();
    this.data = data;
  }

  serialize() {
    return [Types.UserMessages.UW_LOAD_USER_BANS].concat(this.data);
  }
};

// SendLoadPlayerData
UserMessages.SendLoadPlayerData = class extends Message {
  constructor(playerName, playerData) {
    super();
    this.playerName = playerName;
    this.playerData = playerData;
  }

  serialize() {
    return [
      Types.UserMessages.UW_LOAD_PLAYER_DATA,
      this.playerName,
      this.playerData
    ];
  }
};

export default UserMessages;

import { Types } from '../common.js';

class Message {}

const UserMessages = {};

UserMessages.UpdatePlayerCount = class UpdatePlayerCount extends Message {
    constructor(count, maxCount) {
        super();
        this.count = count;
        this.maxCount = maxCount;
    }
    serialize() {
        return [
            Types.UserMessages.WU_UPDATE_PLAYER_COUNT,
            this.count,
            this.maxCount
        ];
    }
};

UserMessages.SendPlayerGold = class SendPlayerGold extends Message {
    constructor(name, gold) {
        super();
        this.name = name;
        this.gold = gold;
    }
    serialize() {
        return [Types.UserMessages.WU_ADD_PLAYER_GOLD, this.name, this.gold];
    }
};

UserMessages.SavePlayerAuctions = class SavePlayerAuctions extends Message {
    constructor(data) {
        super();
        this.data = data;
    }
    serialize() {
        return [Types.UserMessages.WU_SAVE_PLAYER_AUCTIONS].concat(this.data);
    }
};

UserMessages.SavePlayerLooks = class SavePlayerLooks extends Message {
    constructor(data) {
        super();
        this.data = data;
    }
    serialize() {
        return [Types.UserMessages.WU_SAVE_PLAYER_LOOKS].concat(this.data);
    }
};

UserMessages.SaveUserBans = class SaveUserBans extends Message {
    constructor(data) {
        super();
        this.data = data;
    }
    serialize() {
        return [Types.UserMessages.WU_SAVE_USER_BANS, this.data];
    }
};

UserMessages.ServerInfo = class ServerInfo extends Message {
    constructor(config, count) {
        super();
        this.config = config;
        this.count = count || 0;
    }
    serialize() {
        return [
            Types.UserMessages.WU_GAMESERVER_INFO,
            this.config.world_name,
            this.count,
            this.config.nb_players_per_world,
            this.config.address,
            this.config.port,
            this.config.user_password,
            this.config.world_key
        ];
    }
};

UserMessages.SavePlayersList = class SavePlayersList extends Message {
    constructor(data) {
        super();
        this.data = data;
    }
    serialize() {
        return [Types.UserMessages.WU_SAVE_PLAYERS_LIST, this.data];
    }
};

UserMessages.playerLoggedIn = class playerLoggedIn extends Message {
    constructor(status, username, playerName) {
        super();
        this.status = status;
        this.username = username;
        this.playerName = playerName;
    }
    serialize() {
        return [
            Types.UserMessages.WU_PLAYER_LOGGED_IN,
            this.status,
            this.username,
            this.playerName
        ];
    }
};

UserMessages.SavePlayerData = class SavePlayerData extends Message {
    constructor(playerName, playerData, update) {
        super();
        this.playerName = playerName;
        this.playerData = playerData;
        this.update = update;
    }
    serialize() {
        return [
            Types.UserMessages.WU_SAVE_PLAYER_DATA,
            this.playerName,
            this.playerData,
            this.update ? 1 : 0
        ];
    }
};

export default UserMessages;

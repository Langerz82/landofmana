class BanManager {
    constructor(world) {
        this.world = world;
        this.userBans = {};
    }

    saveBans() {
        const now = Date.now();

        const data = [];
        for (const username in this.userBans)
        {
            const banTime = this.userBans[username];
            if (banTime < now)
                continue;

            const rec = username+","+banTime;
            data.push(rec);
        }
        return data;
    }

    loadBans(msg) {
        const now = Date.now();

        for(const rec of msg) {
            const ban = rec.split(",");
            if (now > (ban[1]))
                continue;
            this.userBans[ban[0]] = ban[1];
        }
    }

    isUserBanned(username) {
        if (this.userBans.hasOwnProperty(username) &&
            this.userBans[username] > Date.now())
        {
            return true;
        }
        return false;
    }

    banplayer(name, duration) {
        name = name.toLowerCase();
        const player = this.world.getPlayerByName(name);
        if (!player) {
            console.info("worldServer, banplayer: player not in world.");
            return;
        }
        const username = player.user.name;
        this.banuser(username, duration);
    }

    banuser(username, duration) {
        duration *= 86400 * 1000;
        this.userBans[username] = Date.now() + duration;
    }

    save() {
        if (this.world.userHandler) {
            const data = this.saveBans();
            this.world.userHandler.sendBansData(data);
            return true;
        }
        else {
            console.info("worldserver, save: userHandler not set");
        }
        return false;
    }
}

export default BanManager;

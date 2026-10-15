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

class BanManager {
    constructor(world) {
        this.world = world;
        this.userBans = {};
    }

    saveBans() {
        const now = Date.now();

        const data = [];
        for (const username in this.userBans) {
            const banTime = this.userBans[username];
            if (banTime < now) continue;

            const rec = username + ',' + banTime;
            data.push(rec);
        }
        return data;
    }

    loadBans(msg) {
        const now = Date.now();

        for (const rec of msg) {
            const ban = rec.split(',');
            // FIX: `ban[1]` is a string from split() -- `now > ban[1]` and
            // `this.userBans[ban[0]] = ban[1]` happened to still work via
            // JS's numeric-string coercion on `<`/`>` and isUserBanned()'s
            // `> Date.now()` check, but banuser() (below) stores a real
            // number for the same map. Parsing here keeps the stored type
            // consistent between both code paths.
            const banTime = parseInt(ban[1], 10);
            if (now > banTime) continue;
            this.userBans[ban[0]] = banTime;
        }
    }

    isUserBanned(username) {
        if (
            this.userBans.hasOwnProperty(username) &&
            this.userBans[username] > Date.now()
        ) {
            return true;
        }
        return false;
    }

    banplayer(name, duration) {
        name = name.toLowerCase();
        const player = this.world.getPlayerByName(name);
        if (!player) {
            console.info('worldServer, banplayer: player not in world.');
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
        } else {
            console.info('worldserver, save: userHandler not set');
        }
        return false;
    }
}

export default BanManager;
